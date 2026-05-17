import { db } from "@my-better-t-app/db";
import { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { LIVE_CACHE_SECONDS } from "../services/constants";
import { isForcedLiveTwitchLogin } from "../services/live-overrides";
import { toPublicPrice } from "../services/pricing-schema";
import { getLiveStreamsByUserIds } from "../services/twitch";

async function refreshStaleProfiles<
	T extends {
		id: string;
		twitchChannelId: string;
		twitchChannelLogin: string;
		liveCheckedAt: Date | null;
	},
>(profiles: T[]) {
	const now = Date.now();
	const staleProfiles = profiles.filter(
		(profile) =>
			!profile.liveCheckedAt ||
			now - profile.liveCheckedAt.getTime() > LIVE_CACHE_SECONDS * 1000,
	);

	if (staleProfiles.length === 0) return;

	const liveStreams = await getLiveStreamsByUserIds(
		staleProfiles.map((profile) => profile.twitchChannelId),
	);
	const liveStreamsById = new Map(
		liveStreams.map((stream) => [stream.userId, stream]),
	);

	await Promise.all(
		staleProfiles.map((profile) => {
			const liveStream = liveStreamsById.get(profile.twitchChannelId);
			return db
				.update(streamerProfiles)
				.set({
					isLive:
						Boolean(liveStream) ||
						isForcedLiveTwitchLogin(profile.twitchChannelLogin),
					liveStreamTitle: liveStream?.title ?? null,
					liveStreamThumbnailUrl: liveStream?.thumbnailUrl ?? null,
					liveCheckedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(streamerProfiles.id, profile.id));
		}),
	);
}

function toPublicStreamer(profile: typeof streamerProfiles.$inferSelect) {
	return {
		id: profile.id,
		twitchChannelLogin: profile.twitchChannelLogin,
		twitchDisplayName: profile.twitchDisplayName,
		twitchAvatarUrl: profile.twitchAvatarUrl,
		moderateGiphySubmissions: profile.moderateGiphySubmissions,
		allowCustomUploads: profile.allowCustomUploads,
		giphyAccess: profile.giphyAccess,
		uploadAccess: profile.uploadAccess,
		allowGifSubmissions: profile.allowGifSubmissions,
		allowSoundSubmissions: profile.allowSoundSubmissions,
		giphyPrice: toPublicPrice(
			profile.giphyPriceCurrency,
			profile.giphyPriceAmount,
		),
		uploadPrice: profile.allowCustomUploads
			? toPublicPrice(profile.uploadPriceCurrency, profile.uploadPriceAmount)
			: null,
		soundPrice:
			profile.allowSoundSubmissions !== false
				? toPublicPrice(profile.soundPriceCurrency, profile.soundPriceAmount)
				: null,
		isLive:
			profile.isLive || isForcedLiveTwitchLogin(profile.twitchChannelLogin),
		streamTitle: profile.liveStreamTitle,
		streamThumbnailUrl: profile.liveStreamThumbnailUrl,
		shareVisitCount: profile.shareVisitCount,
	};
}

export const streamersRouter = router({
	listLive: publicProcedure.query(async () => {
		const profiles = await db
			.select()
			.from(streamerProfiles)
			.where(eq(streamerProfiles.isEnrolled, true));

		await refreshStaleProfiles(profiles);

		if (profiles.length > 0) {
			const refreshed = await db
				.select()
				.from(streamerProfiles)
				.where(
					and(
						eq(streamerProfiles.isEnrolled, true),
						inArray(
							streamerProfiles.id,
							profiles.map((profile) => profile.id),
						),
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
			.filter(
				(profile) =>
					profile.isLive || isForcedLiveTwitchLogin(profile.twitchChannelLogin),
			)
			.map(toPublicStreamer);
	}),
	getByLogin: publicProcedure
		.input(z.object({ login: z.string().trim().min(1).max(64) }))
		.query(async ({ input }) => {
			const [profile] = await db
				.select()
				.from(streamerProfiles)
				.where(
					and(
						ilike(streamerProfiles.twitchChannelLogin, input.login.trim()),
						eq(streamerProfiles.isEnrolled, true),
					),
				)
				.limit(1);

			if (!profile) return null;

			await refreshStaleProfiles([profile]);

			const [refreshed] = await db
				.select()
				.from(streamerProfiles)
				.where(eq(streamerProfiles.id, profile.id))
				.limit(1);

			return refreshed ? toPublicStreamer(refreshed) : null;
		}),
	recordShareVisit: publicProcedure
		.input(z.object({ streamerProfileId: z.uuid() }))
		.mutation(async ({ input }) => {
			const [profile] = await db
				.update(streamerProfiles)
				.set({
					shareVisitCount: sql`${streamerProfiles.shareVisitCount} + 1`,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(streamerProfiles.id, input.streamerProfileId),
						eq(streamerProfiles.isEnrolled, true),
					),
				)
				.returning({ shareVisitCount: streamerProfiles.shareVisitCount });

			return profile ?? null;
		}),
});
