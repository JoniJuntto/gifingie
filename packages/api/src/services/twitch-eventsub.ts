import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@my-better-t-app/db";
import { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { env } from "@my-better-t-app/env/server";
import { eq, or } from "drizzle-orm";

import { insertPaymentCredit } from "./submission-payment";

function eventsubCallbackUrl() {
	return new URL("/api/twitch/eventsub", env.BETTER_AUTH_URL).toString();
}

async function createEventSubSubscription(input: {
	accessToken: string;
	type: string;
	version: string;
	condition: Record<string, string>;
}) {
	const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			type: input.type,
			version: input.version,
			condition: input.condition,
			transport: {
				method: "webhook",
				callback: eventsubCallbackUrl(),
				secret: env.TWITCH_EVENTSUB_SECRET,
			},
		}),
	});

	if (!response.ok && response.status !== 409) {
		const body = await response.text();
		throw new Error(
			`EventSub subscription failed (${input.type}): ${response.status} ${body}`,
		);
	}
}

export async function ensureStreamerEventSubSubscriptions(input: {
	broadcasterId: string;
	accessToken: string;
	channelPoints: boolean;
	bits: boolean;
}) {
	const subscriptions = [];

	if (input.channelPoints) {
		subscriptions.push(
			createEventSubSubscription({
				accessToken: input.accessToken,
				type: "channel.channel_points_custom_reward_redemption.add",
				version: "1",
				condition: { broadcaster_user_id: input.broadcasterId },
			}),
		);
	}

	if (input.bits) {
		subscriptions.push(
			createEventSubSubscription({
				accessToken: input.accessToken,
				type: "channel.cheer",
				version: "1",
				condition: { broadcaster_user_id: input.broadcasterId },
			}),
		);
	}

	await Promise.all(subscriptions);
}

export function verifyEventSubSignature(input: {
	messageId: string;
	timestamp: string;
	body: string;
	signature: string;
}) {
	const message = input.messageId + input.timestamp + input.body;
	const expected =
		"sha256=" +
		createHmac("sha256", env.TWITCH_EVENTSUB_SECRET)
			.update(message)
			.digest("hex");

	const expectedBuffer = Buffer.from(expected);
	const signatureBuffer = Buffer.from(input.signature);
	if (
		expectedBuffer.length !== signatureBuffer.length ||
		!timingSafeEqual(expectedBuffer, signatureBuffer)
	) {
		throw new Error("Invalid EventSub signature.");
	}
}

async function findStreamerByRewardId(rewardId: string) {
	const [profile] = await db
		.select()
		.from(streamerProfiles)
		.where(
			or(
				eq(streamerProfiles.giphyChannelPointsRewardId, rewardId),
				eq(streamerProfiles.uploadChannelPointsRewardId, rewardId),
				eq(streamerProfiles.soundChannelPointsRewardId, rewardId),
			),
		)
		.limit(1);

	return profile ?? null;
}

async function findStreamerByBroadcasterId(broadcasterId: string) {
	const [profile] = await db
		.select()
		.from(streamerProfiles)
		.where(eq(streamerProfiles.twitchChannelId, broadcasterId))
		.limit(1);

	return profile ?? null;
}

export async function handleEventSubNotification(payload: {
	subscription: { type: string };
	event: Record<string, unknown>;
}) {
	const type = payload.subscription.type;

	if (type === "channel.channel_points_custom_reward_redemption.add") {
		const reward = payload.event.reward as
			| { id?: string; cost?: number }
			| undefined;
		const rewardId = String(reward?.id ?? "");
		const userId = String(payload.event.user_id ?? "");
		const redemptionId = String(payload.event.id ?? "");
		const cost = Number(reward?.cost ?? 0);

		if (!rewardId || !userId || !redemptionId || cost < 1) return;

		const profile = await findStreamerByRewardId(rewardId);
		if (!profile) return;

		await insertPaymentCredit({
			streamerProfileId: profile.id,
			viewerTwitchId: userId,
			kind: "channel_points",
			amount: cost,
			externalId: redemptionId,
			channelPointsRewardId: rewardId,
		});
		return;
	}

	if (type === "channel.cheer") {
		const broadcasterId = String(payload.event.broadcaster_user_id ?? "");
		const userId = String(payload.event.user_id ?? "");
		const bits = Number(payload.event.bits ?? 0);
		const eventId = String(payload.event.id ?? "");

		if (!broadcasterId || !userId || bits < 1 || !eventId) return;

		const profile = await findStreamerByBroadcasterId(broadcasterId);
		if (!profile) return;

		await insertPaymentCredit({
			streamerProfileId: profile.id,
			viewerTwitchId: userId,
			kind: "bits",
			amount: bits,
			externalId: eventId,
		});
	}
}
