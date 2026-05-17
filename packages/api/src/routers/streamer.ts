import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { OVERLAY_BACKLOG_LIMIT } from "../services/constants";
import { overlaySettingsInputSchema } from "../services/overlay-settings";
import { createOverlayToken } from "../services/tokens";
import { getTwitchUserById } from "../services/twitch";
import { createSignedDisplayUrl } from "../services/uploads";

async function getTwitchAccountForUser(userId: string) {
	const [twitchAccount] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
		.limit(1);

	return twitchAccount ?? null;
}

async function getStreamerProfileForUser(userId: string) {
	const [profile] = await db
		.select({ id: streamerProfiles.id })
		.from(streamerProfiles)
		.where(eq(streamerProfiles.userId, userId))
		.limit(1);

	return profile ?? null;
}

async function assertBacklogAvailable(streamerProfileId: string) {
	const [backlog] = await db
		.select({ value: count() })
		.from(gifSubmissions)
		.where(
			and(
				eq(gifSubmissions.streamerProfileId, streamerProfileId),
				isNull(gifSubmissions.displayedAt),
				ne(gifSubmissions.moderationStatus, "rejected"),
			),
		);

	if ((backlog?.value ?? 0) > OVERLAY_BACKLOG_LIMIT) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: "Overlay queue is full.",
		});
	}
}

async function withDisplayUrls<
	T extends {
		source: "giphy" | "upload";
		gifUrl: string | null;
		previewUrl: string | null;
		s3Key: string | null;
	},
>(submissions: T[]) {
	return Promise.all(
		submissions.map(async (submission) => {
			const signedUrl =
				submission.source === "upload" && submission.s3Key
					? await createSignedDisplayUrl(submission.s3Key)
					: null;

			return {
				...submission,
				gifUrl: signedUrl ?? submission.gifUrl ?? "",
				previewUrl: signedUrl ?? submission.previewUrl,
			};
		}),
	);
}

export const streamerRouter = router({
	enroll: protectedProcedure.mutation(async ({ ctx }) => {
		const twitchAccount = await getTwitchAccountForUser(ctx.session.user.id);
		if (!twitchAccount) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Sign in with Twitch before enrolling.",
			});
		}

		const twitchUser = await getTwitchUserById(twitchAccount.accountId);
		if (!twitchUser) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Could not load Twitch channel.",
			});
		}

		const [profile] = await db
			.insert(streamerProfiles)
			.values({
				userId: ctx.session.user.id,
				twitchChannelId: twitchUser.id,
				twitchChannelLogin: twitchUser.login,
				twitchDisplayName: twitchUser.displayName,
				twitchAvatarUrl: twitchUser.avatarUrl,
				isEnrolled: true,
				overlayToken: createOverlayToken(),
			})
			.onConflictDoUpdate({
				target: streamerProfiles.userId,
				set: {
					twitchChannelId: twitchUser.id,
					twitchChannelLogin: twitchUser.login,
					twitchDisplayName: twitchUser.displayName,
					twitchAvatarUrl: twitchUser.avatarUrl,
					isEnrolled: true,
					updatedAt: new Date(),
				},
			})
			.returning();

		return profile;
	}),
	regenerateOverlayToken: protectedProcedure.mutation(async ({ ctx }) => {
		const [profile] = await db
			.update(streamerProfiles)
			.set({
				overlayToken: createOverlayToken(),
				updatedAt: new Date(),
			})
			.where(eq(streamerProfiles.userId, ctx.session.user.id))
			.returning();

		if (!profile) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Streamer profile not found.",
			});
		}

		return profile;
	}),
	updateOverlaySettings: protectedProcedure
		.input(overlaySettingsInputSchema)
		.mutation(async ({ ctx, input }) => {
			const [profile] = await db
				.update(streamerProfiles)
				.set({
					gifDisplaySeconds: input.gifDisplaySeconds,
					overlayGifXPercent: input.overlayGifXPercent,
					overlayGifYPercent: input.overlayGifYPercent,
					overlayGifWidthPercent: input.overlayGifWidthPercent,
					overlayGifHeightPercent: input.overlayGifHeightPercent,
					updatedAt: new Date(),
				})
				.where(eq(streamerProfiles.userId, ctx.session.user.id))
				.returning();

			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Streamer profile not found.",
				});
			}

			return profile;
		}),
	updateModerationSettings: protectedProcedure
		.input(
			z.object({
				moderateGiphySubmissions: z.boolean(),
				allowCustomUploads: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [profile] = await db
				.update(streamerProfiles)
				.set({
					moderateGiphySubmissions: input.moderateGiphySubmissions,
					allowCustomUploads: input.allowCustomUploads,
					updatedAt: new Date(),
				})
				.where(eq(streamerProfiles.userId, ctx.session.user.id))
				.returning();

			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Streamer profile not found.",
				});
			}

			return profile;
		}),
	pendingModeration: protectedProcedure.query(async ({ ctx }) => {
		const profile = await getStreamerProfileForUser(ctx.session.user.id);
		if (!profile) {
			return [];
		}

		const submissions = await db
			.select({
				id: gifSubmissions.id,
				source: gifSubmissions.source,
				giphyId: gifSubmissions.giphyId,
				gifUrl: gifSubmissions.gifUrl,
				previewUrl: gifSubmissions.previewUrl,
				title: gifSubmissions.title,
				caption: gifSubmissions.caption,
				s3Key: gifSubmissions.s3Key,
				contentType: gifSubmissions.contentType,
				byteSize: gifSubmissions.byteSize,
				originalFilename: gifSubmissions.originalFilename,
				moderationStatus: gifSubmissions.moderationStatus,
				createdAt: gifSubmissions.createdAt,
			})
			.from(gifSubmissions)
			.where(
				and(
					eq(gifSubmissions.streamerProfileId, profile.id),
					eq(gifSubmissions.moderationStatus, "pending"),
					or(
						eq(gifSubmissions.source, "giphy"),
						isNotNull(gifSubmissions.uploadedAt),
					),
				),
			)
			.orderBy(desc(gifSubmissions.createdAt))
			.limit(50);

		return withDisplayUrls(submissions);
	}),
	approveSubmission: protectedProcedure
		.input(z.object({ submissionId: z.number().int().positive() }))
		.mutation(async ({ ctx, input }) => {
			const profile = await getStreamerProfileForUser(ctx.session.user.id);
			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Streamer profile not found.",
				});
			}

			const [submission] = await db
				.update(gifSubmissions)
				.set({ moderationStatus: "approved" })
				.where(
					and(
						eq(gifSubmissions.id, input.submissionId),
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.moderationStatus, "pending"),
					),
				)
				.returning();

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Pending submission not found.",
				});
			}

			return submission;
		}),
	rejectSubmission: protectedProcedure
		.input(z.object({ submissionId: z.number().int().positive() }))
		.mutation(async ({ ctx, input }) => {
			const profile = await getStreamerProfileForUser(ctx.session.user.id);
			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Streamer profile not found.",
				});
			}

			const [submission] = await db
				.update(gifSubmissions)
				.set({ moderationStatus: "rejected" })
				.where(
					and(
						eq(gifSubmissions.id, input.submissionId),
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.moderationStatus, "pending"),
					),
				)
				.returning();

			if (!submission) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Pending submission not found.",
				});
			}

			return submission;
		}),
	replaySubmission: protectedProcedure
		.input(z.object({ submissionId: z.number().int().positive() }))
		.mutation(async ({ ctx, input }) => {
			const profile = await getStreamerProfileForUser(ctx.session.user.id);
			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Streamer profile not found.",
				});
			}

			const [original] = await db
				.select({
					streamerProfileId: gifSubmissions.streamerProfileId,
					viewerUserId: gifSubmissions.viewerUserId,
					source: gifSubmissions.source,
					moderationStatus: gifSubmissions.moderationStatus,
					giphyId: gifSubmissions.giphyId,
					gifUrl: gifSubmissions.gifUrl,
					previewUrl: gifSubmissions.previewUrl,
					title: gifSubmissions.title,
					caption: gifSubmissions.caption,
					s3Key: gifSubmissions.s3Key,
					contentType: gifSubmissions.contentType,
					byteSize: gifSubmissions.byteSize,
					originalFilename: gifSubmissions.originalFilename,
					uploadedAt: gifSubmissions.uploadedAt,
				})
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.id, input.submissionId),
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.moderationStatus, "approved"),
					),
				)
				.limit(1);

			if (!original) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Approved submission not found.",
				});
			}

			await assertBacklogAvailable(profile.id);

			const [replay] = await db
				.insert(gifSubmissions)
				.values({
					streamerProfileId: original.streamerProfileId,
					viewerUserId: original.viewerUserId,
					source: original.source,
					moderationStatus: "approved",
					giphyId: original.giphyId,
					gifUrl: original.gifUrl,
					previewUrl: original.previewUrl,
					title: original.title,
					caption: original.caption,
					s3Key: original.s3Key,
					contentType: original.contentType,
					byteSize: original.byteSize,
					originalFilename: original.originalFilename,
					uploadedAt: original.uploadedAt,
					displayedAt: null,
				})
				.returning();

			return replay;
		}),
	recentSubmissions: protectedProcedure.query(async ({ ctx }) => {
		const profile = await getStreamerProfileForUser(ctx.session.user.id);
		if (!profile) {
			return [];
		}

		const submissions = await db
			.select({
				id: gifSubmissions.id,
				source: gifSubmissions.source,
				giphyId: gifSubmissions.giphyId,
				gifUrl: gifSubmissions.gifUrl,
				previewUrl: gifSubmissions.previewUrl,
				title: gifSubmissions.title,
				caption: gifSubmissions.caption,
				s3Key: gifSubmissions.s3Key,
				contentType: gifSubmissions.contentType,
				byteSize: gifSubmissions.byteSize,
				originalFilename: gifSubmissions.originalFilename,
				moderationStatus: gifSubmissions.moderationStatus,
				displayedAt: gifSubmissions.displayedAt,
				createdAt: gifSubmissions.createdAt,
			})
			.from(gifSubmissions)
			.where(eq(gifSubmissions.streamerProfileId, profile.id))
			.orderBy(desc(gifSubmissions.createdAt))
			.limit(12);

		return withDisplayUrls(submissions);
	}),
});
