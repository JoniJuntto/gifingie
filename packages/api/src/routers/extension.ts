import { db } from "@my-better-t-app/db";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { and, count, desc, eq, gte, isNull, ne } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
	DUPLICATE_WINDOW_SECONDS,
	OVERLAY_BACKLOG_LIMIT,
	SUBMIT_RATE_LIMIT_SECONDS,
} from "../services/constants";
import {
	normalizeSubmissionCaption,
	resolveSubmissionModerationStatus,
} from "../services/captions";
import { searchGiphy } from "../services/giphy";
import { isForcedLiveTwitchLogin } from "../services/live-overrides";
import { isUserLive } from "../services/twitch";
import { addExtensionCorsHeaders } from "../extension-cors";
import {
	verifyExtensionJWT,
	verifyBitsReceipt,
} from "../services/twitch-extension-jwt";

async function extractExtensionContext(request: Request) {
	const authHeader = request.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}
	const token = authHeader.slice(7);
	try {
		return await verifyExtensionJWT(token);
	} catch {
		return null;
	}
}

export const extensionRouter = new Elysia({ prefix: "/api/extension" })
	.onAfterHandle(({ request, set }) => {
		addExtensionCorsHeaders(
			request.headers.get("origin"),
			set.headers as Record<string, string>,
		);
	})
	.options("/*", ({ request }) => {
		const origin = request.headers.get("origin");
		const headers: Record<string, string> = {};
		addExtensionCorsHeaders(origin, headers);
		return new Response(null, { status: 204, headers });
	})
	.get("/channel", async ({ request, status }) => {
		const ctx = await extractExtensionContext(request);
		if (!ctx) return status(401, { error: "Unauthorized" });

		const [profile] = await db
			.select()
			.from(streamerProfiles)
			.where(
				and(
					eq(streamerProfiles.twitchChannelId, ctx.channelId),
					eq(streamerProfiles.isEnrolled, true),
				),
			)
			.limit(1);

		if (!profile) {
			return {
				enrolled: false,
				displayName: null,
				avatarUrl: null,
				giphyEnabled: false,
				giphyAccess: "everyone" as const,
				giphyPriceCurrency: "none" as const,
				giphyPriceAmount: null,
			};
		}

		const priceCurrency =
			profile.giphyPriceCurrency === "bits" ? "bits" : ("none" as const);

		return {
			enrolled: true,
			displayName: profile.twitchDisplayName,
			avatarUrl: profile.twitchAvatarUrl,
			giphyEnabled: profile.allowGifSubmissions,
			giphyAccess: profile.giphyAccess,
			giphyPriceCurrency: priceCurrency,
			giphyPriceAmount:
				priceCurrency === "bits" ? profile.giphyPriceAmount : null,
		};
	})
	.get(
		"/giphy/search",
		async ({ request, query, status }) => {
			const ctx = await extractExtensionContext(request);
			if (!ctx) return status(401, { error: "Unauthorized" });

			const q = query.q?.trim();
			if (!q) return { gifs: [] };

			try {
				const gifs = await searchGiphy(q);
				return { gifs };
			} catch {
				return status(500, { error: "GIPHY search failed" });
			}
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/submit",
		async ({ request, body, status }) => {
			const ctx = await extractExtensionContext(request);
			if (!ctx) return status(401, { error: "Unauthorized" });

			const viewerTwitchId = ctx.userId ?? ctx.opaqueUserId;

			const [profile] = await db
				.select()
				.from(streamerProfiles)
				.where(
					and(
						eq(streamerProfiles.twitchChannelId, ctx.channelId),
						eq(streamerProfiles.isEnrolled, true),
					),
				)
				.limit(1);

			if (!profile) return status(404, { error: "Streamer not found" });
			if (!profile.allowGifSubmissions)
				return status(403, { error: "GIF submissions are disabled" });

			const live =
				isForcedLiveTwitchLogin(profile.twitchChannelLogin) ||
				(await isUserLive(profile.twitchChannelId));
			if (!live) return status(409, { error: "Streamer is offline" });

			const [backlog] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						isNull(gifSubmissions.displayedAt),
						ne(gifSubmissions.moderationStatus, "rejected"),
					),
				);
			if ((backlog?.value ?? 0) >= OVERLAY_BACKLOG_LIMIT) {
				return status(429, { error: "Overlay queue is full" });
			}

			const rateWindowStart = new Date(
				Date.now() - SUBMIT_RATE_LIMIT_SECONDS * 1000,
			);
			const [recentSubmission] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.viewerTwitchId, viewerTwitchId),
						gte(gifSubmissions.createdAt, rateWindowStart),
					),
				);
			if ((recentSubmission?.value ?? 0) > 0) {
				return status(429, { error: "Please wait before sending again" });
			}

			const duplicateWindowStart = new Date(
				Date.now() - DUPLICATE_WINDOW_SECONDS * 1000,
			);
			const [recentDuplicate] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.giphyId, body.giphyId),
						gte(gifSubmissions.createdAt, duplicateWindowStart),
					),
				);
			if ((recentDuplicate?.value ?? 0) > 0) {
				return status(409, { error: "That GIF was already sent recently" });
			}

			let extensionTransactionId: string | null = null;

			if (profile.giphyPriceCurrency === "bits" && profile.giphyPriceAmount) {
				if (!body.transactionReceipt) {
					return status(402, {
						error: `Payment required: ${profile.giphyPriceAmount} bits`,
					});
				}

				let receipt: Awaited<ReturnType<typeof verifyBitsReceipt>>;
				try {
					receipt = await verifyBitsReceipt(body.transactionReceipt);
				} catch {
					return status(403, { error: "Invalid bits transaction receipt" });
				}

				if (receipt.product.cost.amount < profile.giphyPriceAmount) {
					return status(402, {
						error: `Insufficient bits: need ${profile.giphyPriceAmount}, got ${receipt.product.cost.amount}`,
					});
				}

				extensionTransactionId = receipt.transactionId;
			}

			const caption = normalizeSubmissionCaption(body.caption);
			const moderationStatus = resolveSubmissionModerationStatus({
				caption,
				source: "giphy",
				moderateGiphySubmissions: profile.moderateGiphySubmissions,
			});

			const insertValues = {
				streamerProfileId: profile.id,
				viewerTwitchId,
				source: "giphy" as const,
				moderationStatus,
				giphyId: body.giphyId,
				gifUrl: body.gifUrl,
				previewUrl: body.previewUrl ?? null,
				title: body.title,
				caption,
				extensionTransactionId,
			};

			let submission: typeof gifSubmissions.$inferSelect | undefined;

			if (extensionTransactionId) {
				const [existing] = await db
					.select()
					.from(gifSubmissions)
					.where(
						eq(gifSubmissions.extensionTransactionId, extensionTransactionId),
					)
					.limit(1);
				if (existing) {
					return { submissionId: existing.id };
				}
			}

			try {
				const [row] = await db
					.insert(gifSubmissions)
					.values(insertValues)
					.returning();
				submission = row;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				if (
					extensionTransactionId &&
					msg.includes("gif_submissions_extension_tx_idx")
				) {
					return status(409, { error: "Transaction already used" });
				}
				throw err;
			}

			if (!submission) {
				return status(500, { error: "Failed to create submission" });
			}

			return { submissionId: submission.id };
		},
		{
			body: t.Object({
				giphyId: t.String({ minLength: 1 }),
				gifUrl: t.String({ minLength: 1 }),
				previewUrl: t.Optional(t.String()),
				title: t.String({ minLength: 1 }),
				caption: t.Optional(t.String({ maxLength: 500 })),
				transactionReceipt: t.Optional(t.String()),
			}),
		},
	)
	.get("/submissions", async ({ request, status }) => {
		const ctx = await extractExtensionContext(request);
		if (!ctx) return status(401, { error: "Unauthorized" });

		const viewerTwitchId = ctx.userId ?? ctx.opaqueUserId;

		const [profile] = await db
			.select({ id: streamerProfiles.id })
			.from(streamerProfiles)
			.where(
				and(
					eq(streamerProfiles.twitchChannelId, ctx.channelId),
					eq(streamerProfiles.isEnrolled, true),
				),
			)
			.limit(1);

		if (!profile) return { submissions: [] };

		const rows = await db
			.select({
				id: gifSubmissions.id,
				gifUrl: gifSubmissions.gifUrl,
				previewUrl: gifSubmissions.previewUrl,
				title: gifSubmissions.title,
				moderationStatus: gifSubmissions.moderationStatus,
				createdAt: gifSubmissions.createdAt,
			})
			.from(gifSubmissions)
			.where(
				and(
					eq(gifSubmissions.streamerProfileId, profile.id),
					eq(gifSubmissions.viewerTwitchId, viewerTwitchId),
				),
			)
			.orderBy(desc(gifSubmissions.createdAt))
			.limit(10);

		return { submissions: rows };
	});
