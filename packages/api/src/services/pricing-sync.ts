import { db } from "@my-better-t-app/db";
import { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { PriceCurrency } from "./pricing-schema";
import { getTwitchAccountForUser } from "./submission-payment";
import { upsertChannelPointsReward } from "./twitch";
import { ensureStreamerEventSubSubscriptions } from "./twitch-eventsub";

export const TWITCH_REDEMPTIONS_SCOPE = "channel:manage:redemptions";

export function hasRedemptionsScope(scope: string | null) {
	return Boolean(
		scope?.split(/[\s,]+/).includes(TWITCH_REDEMPTIONS_SCOPE),
	);
}

async function syncRewardForSide(input: {
	broadcasterId: string;
	accessToken: string;
	currency: PriceCurrency;
	amount: number | null;
	title: string;
	existingRewardId: string | null;
}) {
	if (input.currency !== "channel_points" || !input.amount || input.amount < 1) {
		return null;
	}

	return upsertChannelPointsReward({
		broadcasterId: input.broadcasterId,
		accessToken: input.accessToken,
		title: input.title,
		cost: input.amount,
		existingRewardId: input.existingRewardId,
	});
}

export async function syncStreamerPricing(input: {
	profileId: string;
	userId: string;
	twitchChannelId: string;
	giphyPriceCurrency: PriceCurrency;
	giphyPriceAmount: number | null;
	uploadPriceCurrency: PriceCurrency;
	uploadPriceAmount: number | null;
	soundPriceCurrency: PriceCurrency;
	soundPriceAmount: number | null;
	giphyChannelPointsRewardId: string | null;
	uploadChannelPointsRewardId: string | null;
	soundChannelPointsRewardId: string | null;
}) {
	const needsChannelPoints =
		input.giphyPriceCurrency === "channel_points" ||
		input.uploadPriceCurrency === "channel_points" ||
		input.soundPriceCurrency === "channel_points";
	const needsBits =
		input.giphyPriceCurrency === "bits" ||
		input.uploadPriceCurrency === "bits" ||
		input.soundPriceCurrency === "bits";

	let giphyChannelPointsRewardId = input.giphyChannelPointsRewardId;
	let uploadChannelPointsRewardId = input.uploadChannelPointsRewardId;
	let soundChannelPointsRewardId = input.soundChannelPointsRewardId;

	if (needsChannelPoints) {
		const twitchAccount = await getTwitchAccountForUser(input.userId);
		if (!twitchAccount?.accessToken) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to manage channel point rewards.",
			});
		}
		if (!hasRedemptionsScope(twitchAccount.scope)) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to grant channel points management.",
			});
		}

		giphyChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccount.accessToken,
			currency: input.giphyPriceCurrency,
			amount: input.giphyPriceAmount,
			title: "Send a GIF (GIPHY)",
			existingRewardId: giphyChannelPointsRewardId,
		});
		uploadChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccount.accessToken,
			currency: input.uploadPriceCurrency,
			amount: input.uploadPriceAmount,
			title: "Send a custom image",
			existingRewardId: uploadChannelPointsRewardId,
		});
		soundChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccount.accessToken,
			currency: input.soundPriceCurrency,
			amount: input.soundPriceAmount,
			title: "Send a sound",
			existingRewardId: soundChannelPointsRewardId,
		});
	}

	if (needsChannelPoints || needsBits) {
		await ensureStreamerEventSubSubscriptions(input.twitchChannelId);
	}

	const [profile] = await db
		.update(streamerProfiles)
		.set({
			giphyChannelPointsRewardId,
			uploadChannelPointsRewardId,
			soundChannelPointsRewardId,
			updatedAt: new Date(),
		})
		.where(eq(streamerProfiles.id, input.profileId))
		.returning();

	return profile ?? null;
}
