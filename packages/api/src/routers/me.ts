import { db } from "@my-better-t-app/db";
import {
	streamerProfiles,
	userPreferences,
} from "@my-better-t-app/db/schema/domain";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const selectedRoleSchema = z.enum(["streamer", "viewer"]);

export const meRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const [preferences] = await db
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, userId))
			.limit(1);

		const [streamerProfile] = await db
			.select()
			.from(streamerProfiles)
			.where(eq(streamerProfiles.userId, userId))
			.limit(1);

		return {
			user: ctx.session.user,
			selectedRole: preferences?.selectedRole ?? null,
			streamerProfile: streamerProfile
				? {
						id: streamerProfile.id,
						isEnrolled: streamerProfile.isEnrolled,
						twitchChannelLogin: streamerProfile.twitchChannelLogin,
						twitchDisplayName: streamerProfile.twitchDisplayName,
						twitchAvatarUrl: streamerProfile.twitchAvatarUrl,
						overlayToken: streamerProfile.overlayToken,
						gifDisplaySeconds: streamerProfile.gifDisplaySeconds,
						overlayGifXPercent: streamerProfile.overlayGifXPercent,
						overlayGifYPercent: streamerProfile.overlayGifYPercent,
						overlayGifWidthPercent: streamerProfile.overlayGifWidthPercent,
						overlayGifHeightPercent: streamerProfile.overlayGifHeightPercent,
						shareVisitCount: streamerProfile.shareVisitCount,
						moderateGiphySubmissions: streamerProfile.moderateGiphySubmissions,
						allowCustomUploads: streamerProfile.allowCustomUploads,
						allowGifSubmissions: streamerProfile.allowGifSubmissions,
						allowSoundSubmissions: streamerProfile.allowSoundSubmissions,
						giphyAccess: streamerProfile.giphyAccess,
						uploadAccess: streamerProfile.uploadAccess,
						giphyPriceCurrency: streamerProfile.giphyPriceCurrency,
						giphyPriceAmount: streamerProfile.giphyPriceAmount,
						uploadPriceCurrency: streamerProfile.uploadPriceCurrency,
						uploadPriceAmount: streamerProfile.uploadPriceAmount,
						soundPriceCurrency: streamerProfile.soundPriceCurrency,
						soundPriceAmount: streamerProfile.soundPriceAmount,
						giphyChannelPointsRewardId:
							streamerProfile.giphyChannelPointsRewardId,
						uploadChannelPointsRewardId:
							streamerProfile.uploadChannelPointsRewardId,
						soundChannelPointsRewardId:
							streamerProfile.soundChannelPointsRewardId,
					}
				: null,
		};
	}),
	setRole: protectedProcedure
		.input(z.object({ role: selectedRoleSchema }))
		.mutation(async ({ ctx, input }) => {
			const [preferences] = await db
				.insert(userPreferences)
				.values({
					userId: ctx.session.user.id,
					selectedRole: input.role,
				})
				.onConflictDoUpdate({
					target: userPreferences.userId,
					set: {
						selectedRole: input.role,
						updatedAt: new Date(),
					},
				})
				.returning();

			return preferences;
		}),
});
