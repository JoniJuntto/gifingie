import { db } from "@my-better-t-app/db";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router, sessionProcedure } from "../index";
import {
	normalizeSubmissionCaption,
	resolveSubmissionModerationStatus,
} from "../services/captions";
import {
	DUPLICATE_WINDOW_SECONDS,
	OVERLAY_BACKLOG_LIMIT,
	SUBMIT_RATE_LIMIT_SECONDS,
} from "../services/constants";
import { giphyGifInputSchema, normalizeSubmittedGif } from "../services/giphy";
import { isForcedLiveTwitchLogin } from "../services/live-overrides";
import { isUserLive } from "../services/twitch";
import {
	createSignedDisplayUrl,
	createSignedUploadUrl,
	createUploadObjectKey,
	validateUploadMetadata,
} from "../services/uploads";

async function getEnrolledProfile(streamerProfileId: string) {
	const [profile] = await db
		.select()
		.from(streamerProfiles)
		.where(
			and(
				eq(streamerProfiles.id, streamerProfileId),
				eq(streamerProfiles.isEnrolled, true),
			),
		)
		.limit(1);

	if (!profile) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Streamer is not enrolled.",
		});
	}

	return profile;
}

async function assertStreamerLive(profile: {
	twitchChannelId: string;
	twitchChannelLogin: string;
}) {
	const live =
		isForcedLiveTwitchLogin(profile.twitchChannelLogin) ||
		(await isUserLive(profile.twitchChannelId));

	if (!live) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Streamer is currently offline.",
		});
	}
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

async function assertViewerRateLimit(input: {
	streamerProfileId: string;
	viewerUserId: string;
}) {
	const rateWindowStart = new Date(
		Date.now() - SUBMIT_RATE_LIMIT_SECONDS * 1000,
	);
	const [recentViewerSubmission] = await db
		.select({ value: count() })
		.from(gifSubmissions)
		.where(
			and(
				eq(gifSubmissions.streamerProfileId, input.streamerProfileId),
				eq(gifSubmissions.viewerUserId, input.viewerUserId),
				gte(gifSubmissions.createdAt, rateWindowStart),
			),
		);

	if ((recentViewerSubmission?.value ?? 0) > 0) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: "Please wait before sending another image.",
		});
	}
}

export const gifsRouter = router({
	listCustomUploads: protectedProcedure
		.input(z.object({ streamerProfileId: z.uuid() }))
		.query(async ({ input }) => {
			const profile = await getEnrolledProfile(input.streamerProfileId);
			const submissions = await db
				.select({
					id: gifSubmissions.id,
					gifUrl: gifSubmissions.gifUrl,
					previewUrl: gifSubmissions.previewUrl,
					title: gifSubmissions.title,
					s3Key: gifSubmissions.s3Key,
					contentType: gifSubmissions.contentType,
					byteSize: gifSubmissions.byteSize,
					originalFilename: gifSubmissions.originalFilename,
					createdAt: gifSubmissions.createdAt,
				})
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.source, "upload"),
						eq(gifSubmissions.moderationStatus, "approved"),
						isNotNull(gifSubmissions.uploadedAt),
						isNotNull(gifSubmissions.s3Key),
					),
				)
				.orderBy(desc(gifSubmissions.createdAt))
				.limit(100);

			const uniqueSubmissions = submissions.filter((submission, index) => {
				if (!submission.s3Key) return false;
				return (
					submissions.findIndex(
						(candidate) => candidate.s3Key === submission.s3Key,
					) === index
				);
			});

			return Promise.all(
				uniqueSubmissions.map(async (submission) => {
					const displayUrl = await createSignedDisplayUrl(
						submission.s3Key as string,
					);
					return {
						...submission,
						gifUrl: displayUrl,
						previewUrl: displayUrl,
					};
				}),
			);
		}),
	submit: sessionProcedure
		.input(
			z.object({
				streamerProfileId: z.uuid(),
				gif: giphyGifInputSchema,
				caption: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const profile = await getEnrolledProfile(input.streamerProfileId);
			await assertStreamerLive(profile);
			await assertBacklogAvailable(profile.id);
			await assertViewerRateLimit({
				streamerProfileId: profile.id,
				viewerUserId: ctx.session.user.id,
			});

			const gif = normalizeSubmittedGif(input.gif);
			const duplicateWindowStart = new Date(
				Date.now() - DUPLICATE_WINDOW_SECONDS * 1000,
			);
			const [recentDuplicate] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.giphyId, gif.id),
						gte(gifSubmissions.createdAt, duplicateWindowStart),
					),
				);

			if ((recentDuplicate?.value ?? 0) > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "That GIF was already sent recently.",
				});
			}

			const caption = normalizeSubmissionCaption(input.caption);
			const moderationStatus = resolveSubmissionModerationStatus({
				caption,
				source: "giphy",
				moderateGiphySubmissions: profile.moderateGiphySubmissions,
			});

			const [submission] = await db
				.insert(gifSubmissions)
				.values({
					streamerProfileId: profile.id,
					viewerUserId: ctx.session.user.id,
					source: "giphy",
					moderationStatus,
					giphyId: gif.id,
					gifUrl: gif.gifUrl,
					previewUrl: gif.previewUrl,
					title: gif.title,
					caption,
				})
				.returning();

			return submission;
		}),
	createUpload: protectedProcedure
		.input(
			z.object({
				streamerProfileId: z.uuid(),
				contentType: z.string().min(1),
				byteSize: z.number().int().positive(),
				originalFilename: z.string().trim().min(1).max(255).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const validationError = validateUploadMetadata(input);
			if (validationError) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: validationError,
				});
			}

			const profile = await getEnrolledProfile(input.streamerProfileId);
			await assertStreamerLive(profile);
			await assertBacklogAvailable(profile.id);
			await assertViewerRateLimit({
				streamerProfileId: profile.id,
				viewerUserId: ctx.session.user.id,
			});

			const title = input.originalFilename?.trim() || "Uploaded image";
			const [submission] = await db
				.insert(gifSubmissions)
				.values({
					streamerProfileId: profile.id,
					viewerUserId: ctx.session.user.id,
					source: "upload",
					moderationStatus: "pending",
					title,
					contentType: input.contentType,
					byteSize: input.byteSize,
					originalFilename: title,
				})
				.returning();

			if (!submission) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Could not create upload submission.",
				});
			}

			const key = createUploadObjectKey({
				streamerProfileId: profile.id,
				submissionId: submission.id,
				originalFilename: input.originalFilename,
			});
			await db
				.update(gifSubmissions)
				.set({ s3Key: key })
				.where(eq(gifSubmissions.id, submission.id));

			const uploadUrl = await createSignedUploadUrl({
				key,
				contentType: input.contentType,
				byteSize: input.byteSize,
			});

			return {
				submissionId: submission.id,
				uploadUrl,
				headers: {
					"Content-Type": input.contentType,
				},
			};
		}),
	completeUpload: protectedProcedure
		.input(
			z.object({
				submissionId: z.number().int().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [existing] = await db
				.select({
					id: gifSubmissions.id,
					source: gifSubmissions.source,
					s3Key: gifSubmissions.s3Key,
					viewerUserId: gifSubmissions.viewerUserId,
					uploadedAt: gifSubmissions.uploadedAt,
				})
				.from(gifSubmissions)
				.where(eq(gifSubmissions.id, input.submissionId))
				.limit(1);

			if (
				!existing ||
				existing.viewerUserId !== ctx.session.user.id ||
				existing.source !== "upload" ||
				!existing.s3Key
			) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Upload submission not found.",
				});
			}

			if (existing.uploadedAt) {
				return existing;
			}

			const [submission] = await db
				.update(gifSubmissions)
				.set({ uploadedAt: new Date() })
				.where(eq(gifSubmissions.id, input.submissionId))
				.returning();

			return submission;
		}),
	resendCustomUpload: protectedProcedure
		.input(
			z.object({
				streamerProfileId: z.uuid(),
				submissionId: z.number().int().positive(),
				caption: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const profile = await getEnrolledProfile(input.streamerProfileId);
			await assertStreamerLive(profile);
			await assertBacklogAvailable(profile.id);
			await assertViewerRateLimit({
				streamerProfileId: profile.id,
				viewerUserId: ctx.session.user.id,
			});

			const [original] = await db
				.select({
					source: gifSubmissions.source,
					gifUrl: gifSubmissions.gifUrl,
					previewUrl: gifSubmissions.previewUrl,
					title: gifSubmissions.title,
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
						eq(gifSubmissions.source, "upload"),
						eq(gifSubmissions.moderationStatus, "approved"),
						isNotNull(gifSubmissions.uploadedAt),
						isNotNull(gifSubmissions.s3Key),
					),
				)
				.limit(1);

			if (!original?.s3Key || !original.uploadedAt) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Approved custom upload not found.",
				});
			}

			const caption = normalizeSubmissionCaption(input.caption);
			const moderationStatus = resolveSubmissionModerationStatus({
				caption,
				source: "upload",
				moderateGiphySubmissions: profile.moderateGiphySubmissions,
			});

			const [submission] = await db
				.insert(gifSubmissions)
				.values({
					streamerProfileId: profile.id,
					viewerUserId: ctx.session.user.id,
					source: "upload",
					moderationStatus,
					gifUrl: original.gifUrl,
					previewUrl: original.previewUrl,
					title: original.title,
					caption,
					s3Key: original.s3Key,
					contentType: original.contentType,
					byteSize: original.byteSize,
					originalFilename: original.originalFilename,
					uploadedAt: original.uploadedAt,
					displayedAt: null,
				})
				.returning();

			return submission;
		}),
});
