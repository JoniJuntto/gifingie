import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import * as z from "zod";

import { protectedProcedure, router } from "../index";
import { getModeratedChannelsForUser } from "../services/twitch";
import { createSignedDisplayUrl } from "../services/uploads";

export const TWITCH_MODERATED_CHANNELS_SCOPE = "user:read:moderated_channels";

function hasModeratedChannelsScope(scope: string | null) {
	return Boolean(scope?.split(/\s+/).includes(TWITCH_MODERATED_CHANNELS_SCOPE));
}

async function getTwitchAccountForUser(userId: string) {
	const [twitchAccount] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
		.limit(1);

	return twitchAccount ?? null;
}

async function getModeratedTwitchChannelIds(userId: string) {
	const twitchAccount = await getTwitchAccountForUser(userId);
	if (!twitchAccount?.accessToken || !twitchAccount.accountId) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Reconnect Twitch to enable moderator tools.",
		});
	}

	if (!hasModeratedChannelsScope(twitchAccount.scope)) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Reconnect Twitch to grant moderator access.",
		});
	}

	const channels = await getModeratedChannelsForUser({
		userId: twitchAccount.accountId,
		accessToken: twitchAccount.accessToken,
	});

	return channels.map((channel) => channel.broadcasterId);
}

async function getModeratableProfiles(userId: string) {
	const twitchAccount = await getTwitchAccountForUser(userId);
	if (!twitchAccount?.accessToken || !twitchAccount.accountId) {
		return { needsReconnect: true as const, channels: [] };
	}

	if (!hasModeratedChannelsScope(twitchAccount.scope)) {
		return { needsReconnect: true as const, channels: [] };
	}

	const moderatedChannels = await getModeratedChannelsForUser({
		userId: twitchAccount.accountId,
		accessToken: twitchAccount.accessToken,
	});
	const moderatedChannelIds = moderatedChannels.map(
		(channel) => channel.broadcasterId,
	);

	if (moderatedChannelIds.length === 0) {
		return { needsReconnect: false as const, channels: [] };
	}

	const profiles = await db
		.select({
			id: streamerProfiles.id,
			twitchChannelId: streamerProfiles.twitchChannelId,
			twitchChannelLogin: streamerProfiles.twitchChannelLogin,
			twitchDisplayName: streamerProfiles.twitchDisplayName,
			twitchAvatarUrl: streamerProfiles.twitchAvatarUrl,
		})
		.from(streamerProfiles)
		.where(
			and(
				eq(streamerProfiles.isEnrolled, true),
				inArray(streamerProfiles.twitchChannelId, moderatedChannelIds),
			),
		);

	return {
		needsReconnect: false as const,
		channels: profiles,
	};
}

async function assertCanModerateProfile(input: {
	userId: string;
	streamerProfileId: string;
}) {
	const moderatedChannelIds = await getModeratedTwitchChannelIds(input.userId);
	if (moderatedChannelIds.length === 0) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not moderate this channel.",
		});
	}

	const [profile] = await db
		.select({
			id: streamerProfiles.id,
			twitchChannelId: streamerProfiles.twitchChannelId,
		})
		.from(streamerProfiles)
		.where(
			and(
				eq(streamerProfiles.id, input.streamerProfileId),
				eq(streamerProfiles.isEnrolled, true),
			),
		)
		.limit(1);

	if (!profile || !moderatedChannelIds.includes(profile.twitchChannelId)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not moderate this channel.",
		});
	}

	return profile;
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

const streamerProfileInput = z.object({ streamerProfileId: z.uuid() });
const submissionActionInput = streamerProfileInput.extend({
	submissionId: z.number().int().positive(),
});

export const moderationRouter = router({
	myChannels: protectedProcedure.query(async ({ ctx }) => {
		return getModeratableProfiles(ctx.session.user.id);
	}),
	pendingSubmissions: protectedProcedure
		.input(streamerProfileInput)
		.query(async ({ ctx, input }) => {
			await assertCanModerateProfile({
				userId: ctx.session.user.id,
				streamerProfileId: input.streamerProfileId,
			});

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
						eq(gifSubmissions.streamerProfileId, input.streamerProfileId),
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
		.input(submissionActionInput)
		.mutation(async ({ ctx, input }) => {
			await assertCanModerateProfile({
				userId: ctx.session.user.id,
				streamerProfileId: input.streamerProfileId,
			});

			const [submission] = await db
				.update(gifSubmissions)
				.set({ moderationStatus: "approved" })
				.where(
					and(
						eq(gifSubmissions.id, input.submissionId),
						eq(gifSubmissions.streamerProfileId, input.streamerProfileId),
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
		.input(submissionActionInput)
		.mutation(async ({ ctx, input }) => {
			await assertCanModerateProfile({
				userId: ctx.session.user.id,
				streamerProfileId: input.streamerProfileId,
			});

			const [submission] = await db
				.update(gifSubmissions)
				.set({ moderationStatus: "rejected" })
				.where(
					and(
						eq(gifSubmissions.id, input.submissionId),
						eq(gifSubmissions.streamerProfileId, input.streamerProfileId),
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
});

export const moderationInternals = {
	hasModeratedChannelsScope,
};
