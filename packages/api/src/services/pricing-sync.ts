import { db } from "@my-better-t-app/db";
import { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { PriceCurrency } from "./pricing-schema";
import { getTwitchAccountForUser } from "./submission-payment";
import { TwitchChannelPointsError, upsertChannelPointsReward } from "./twitch";
import { ensureStreamerEventSubSubscriptions } from "./twitch-eventsub";

export const TWITCH_REDEMPTIONS_SCOPE = "channel:manage:redemptions";
export const TWITCH_BITS_SCOPE = "bits:read";

export function hasRedemptionsScope(scope: string | null) {
	return Boolean(scope?.split(/[\s,]+/).includes(TWITCH_REDEMPTIONS_SCOPE));
}

export function hasBitsScope(scope: string | null) {
	return Boolean(scope?.split(/[\s,]+/).includes(TWITCH_BITS_SCOPE));
}

async function syncRewardForSide(input: {
	broadcasterId: string;
	accessToken: string;
	currency: PriceCurrency;
	amount: number | null;
	title: string;
	existingRewardId: string | null;
}) {
	if (
		input.currency !== "channel_points" ||
		!input.amount ||
		input.amount < 1
	) {
		return null;
	}

	try {
		return await upsertChannelPointsReward({
			broadcasterId: input.broadcasterId,
			accessToken: input.accessToken,
			title: input.title,
			cost: input.amount,
			existingRewardId: input.existingRewardId,
		});
	} catch (error) {
		if (error instanceof TwitchChannelPointsError) {
			throw new TRPCError({
				code:
					error.httpStatus === 401 || error.httpStatus === 403
						? "PRECONDITION_FAILED"
						: "BAD_REQUEST",
				message: error.message,
			});
		}
		throw error;
	}
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

	const needsTwitchAccount = needsChannelPoints || needsBits;
	let twitchAccessToken: string | null = null;
	let twitchScope: string | null = null;
	if (needsTwitchAccount) {
		const twitchAccount = await getTwitchAccountForUser(input.userId);
		twitchAccessToken = twitchAccount?.accessToken ?? null;
		twitchScope = twitchAccount?.scope ?? null;
		if (!twitchAccessToken) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to manage paid submissions.",
			});
		}
	}

	if (needsChannelPoints) {
		if (!twitchAccessToken) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to manage paid submissions.",
			});
		}
		if (!hasRedemptionsScope(twitchScope)) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to grant channel points management.",
			});
		}

		giphyChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccessToken,
			currency: input.giphyPriceCurrency,
			amount: input.giphyPriceAmount,
			title: "Send a GIF (GIPHY)",
			existingRewardId: giphyChannelPointsRewardId,
		});
		uploadChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccessToken,
			currency: input.uploadPriceCurrency,
			amount: input.uploadPriceAmount,
			title: "Send a custom image",
			existingRewardId: uploadChannelPointsRewardId,
		});
		soundChannelPointsRewardId = await syncRewardForSide({
			broadcasterId: input.twitchChannelId,
			accessToken: twitchAccessToken,
			currency: input.soundPriceCurrency,
			amount: input.soundPriceAmount,
			title: "Send a sound",
			existingRewardId: soundChannelPointsRewardId,
		});
	}

	if (needsChannelPoints || needsBits) {
		if (needsBits && !hasBitsScope(twitchScope)) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					"Reconnect Twitch to grant bits read access for cheer notifications.",
			});
		}

		if (needsChannelPoints && !hasRedemptionsScope(twitchScope)) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Reconnect Twitch to grant channel points management.",
			});
		}

		try {
			await ensureStreamerEventSubSubscriptions({
				broadcasterId: input.twitchChannelId,
				channelPoints: needsChannelPoints,
				bits: needsBits,
			});
		} catch (error) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message:
					error instanceof Error
						? error.message
						: "Failed to set up Twitch EventSub notifications.",
			});
		}
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
