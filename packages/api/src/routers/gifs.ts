import { db } from "@my-better-t-app/db";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import {
	DUPLICATE_WINDOW_SECONDS,
	OVERLAY_BACKLOG_LIMIT,
	SUBMIT_RATE_LIMIT_SECONDS,
} from "../services/constants";
import { giphyGifInputSchema, normalizeSubmittedGif } from "../services/giphy";
import { isUserLive } from "../services/twitch";

export const gifsRouter = router({
	submit: protectedProcedure
		.input(
			z.object({
				streamerProfileId: z.uuid(),
				gif: giphyGifInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [profile] = await db
				.select()
				.from(streamerProfiles)
				.where(
					and(
						eq(streamerProfiles.id, input.streamerProfileId),
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

			const live = await isUserLive(profile.twitchChannelId);
			if (!live) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Streamer is currently offline.",
				});
			}

			const [backlog] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						isNull(gifSubmissions.displayedAt),
					),
				);

			if ((backlog?.value ?? 0) > OVERLAY_BACKLOG_LIMIT) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: "Overlay queue is full.",
				});
			}

			const rateWindowStart = new Date(
				Date.now() - SUBMIT_RATE_LIMIT_SECONDS * 1000,
			);
			const [recentViewerSubmission] = await db
				.select({ value: count() })
				.from(gifSubmissions)
				.where(
					and(
						eq(gifSubmissions.streamerProfileId, profile.id),
						eq(gifSubmissions.viewerUserId, ctx.session.user.id),
						gte(gifSubmissions.createdAt, rateWindowStart),
					),
				);

			if ((recentViewerSubmission?.value ?? 0) > 0) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: "Please wait before sending another GIF.",
				});
			}

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

			const [submission] = await db
				.insert(gifSubmissions)
				.values({
					streamerProfileId: profile.id,
					viewerUserId: ctx.session.user.id,
					giphyId: gif.id,
					gifUrl: gif.gifUrl,
					previewUrl: gif.previewUrl,
					title: gif.title,
				})
				.returning();

			return submission;
		}),
});
