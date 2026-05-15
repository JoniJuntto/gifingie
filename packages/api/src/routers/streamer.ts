import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import { createOverlayToken } from "../services/tokens";
import { getTwitchUserById } from "../services/twitch";

async function getTwitchAccountForUser(userId: string) {
	const [twitchAccount] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
		.limit(1);

	return twitchAccount ?? null;
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
	recentSubmissions: protectedProcedure.query(async ({ ctx }) => {
		const [profile] = await db
			.select({ id: streamerProfiles.id })
			.from(streamerProfiles)
			.where(eq(streamerProfiles.userId, ctx.session.user.id))
			.limit(1);

		if (!profile) {
			return [];
		}

		return db
			.select({
				id: gifSubmissions.id,
				giphyId: gifSubmissions.giphyId,
				gifUrl: gifSubmissions.gifUrl,
				title: gifSubmissions.title,
				displayedAt: gifSubmissions.displayedAt,
				createdAt: gifSubmissions.createdAt,
			})
			.from(gifSubmissions)
			.where(eq(gifSubmissions.streamerProfileId, profile.id))
			.orderBy(desc(gifSubmissions.createdAt))
			.limit(12);
	}),
});
