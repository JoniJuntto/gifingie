import { db } from "@my-better-t-app/db";
import { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { and, eq, inArray } from "drizzle-orm";

import { publicProcedure, router } from "../index";
import { LIVE_CACHE_SECONDS } from "../services/constants";
import { getLiveStreamsByUserIds } from "../services/twitch";

export const streamersRouter = router({
	listLive: publicProcedure.query(async () => {
		const profiles = await db
			.select()
			.from(streamerProfiles)
			.where(eq(streamerProfiles.isEnrolled, true));

		const now = Date.now();
		const staleProfiles = profiles.filter(
			(profile) =>
				!profile.liveCheckedAt ||
				now - profile.liveCheckedAt.getTime() > LIVE_CACHE_SECONDS * 1000,
		);

		if (staleProfiles.length > 0) {
			const liveStreams = await getLiveStreamsByUserIds(
				staleProfiles.map((profile) => profile.twitchChannelId),
			);
			const liveIds = new Set(liveStreams.map((stream) => stream.userId));

			await Promise.all(
				staleProfiles.map((profile) =>
					db
						.update(streamerProfiles)
						.set({
							isLive: liveIds.has(profile.twitchChannelId),
							liveCheckedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(streamerProfiles.id, profile.id)),
				),
			);

			const changedIds = staleProfiles.map((profile) => profile.id);
			const refreshed = await db
				.select()
				.from(streamerProfiles)
				.where(
					and(
						eq(streamerProfiles.isEnrolled, true),
						inArray(streamerProfiles.id, changedIds),
					),
				);

			const refreshedById = new Map(
				refreshed.map((profile) => [profile.id, profile]),
			);
			for (const profile of profiles) {
				const refreshedProfile = refreshedById.get(profile.id);
				if (refreshedProfile) {
					Object.assign(profile, refreshedProfile);
				}
			}
		}

		return profiles
			.filter((profile) => profile.isLive)
			.map((profile) => ({
				id: profile.id,
				twitchChannelLogin: profile.twitchChannelLogin,
				twitchDisplayName: profile.twitchDisplayName,
				twitchAvatarUrl: profile.twitchAvatarUrl,
			}));
	}),
});
