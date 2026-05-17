import { env } from "@my-better-t-app/env/server";
import { HelixClient, TwitchAuth } from "velho";

import { buildTwitchThumbnailUrl } from "./twitch-thumbnail";

type TwitchUser = {
	id: string;
	login: string;
	displayName: string;
	avatarUrl?: string;
};

type TwitchStream = {
	userId: string;
	userLogin: string;
	userName: string;
	title: string;
	thumbnailUrl: string | null;
};

type TwitchModeratedChannel = {
	broadcasterId: string;
	broadcasterLogin: string;
	broadcasterName: string;
};

const auth = new TwitchAuth({
	clientId: env.TWITCH_CLIENT_ID,
	clientSecret: env.TWITCH_CLIENT_SECRET,
});

const helix = new HelixClient({
	clientId: env.TWITCH_CLIENT_ID,
	auth,
	defaultToken: { type: "app" },
});

export async function getTwitchUsersByIds(ids: string[]) {
	if (ids.length === 0) {
		return [];
	}

	const response = await helix.get<{
		data: {
			id: string;
			login: string;
			display_name: string;
			profile_image_url?: string;
		}[];
	}>("/users", {
		query: { id: ids },
	});

	return response.data.data.map<TwitchUser>((user) => ({
		id: user.id,
		login: user.login,
		displayName: user.display_name,
		avatarUrl: user.profile_image_url,
	}));
}

export async function getTwitchUserById(id: string) {
	const [user] = await getTwitchUsersByIds([id]);
	return user ?? null;
}

export async function getLiveStreamsByUserIds(ids: string[]) {
	if (ids.length === 0) {
		return [];
	}

	const response = await helix.get<{
		data: {
			user_id: string;
			user_login: string;
			user_name: string;
			title: string;
			thumbnail_url?: string;
		}[];
	}>("/streams", {
		query: { user_id: ids },
	});

	return response.data.data.map<TwitchStream>((stream) => ({
		userId: stream.user_id,
		userLogin: stream.user_login,
		userName: stream.user_name,
		title: stream.title,
		thumbnailUrl: stream.thumbnail_url
			? buildTwitchThumbnailUrl(stream.thumbnail_url, 640, 360)
			: null,
	}));
}

export async function isUserLive(userId: string) {
	const streams = await getLiveStreamsByUserIds([userId]);
	return streams.length > 0;
}

export async function getModeratedChannelsForUser(input: {
	userId: string;
	accessToken: string;
}) {
	const channels: TwitchModeratedChannel[] = [];
	let after: string | undefined;

	do {
		const url = new URL("https://api.twitch.tv/helix/moderation/channels");
		url.searchParams.set("user_id", input.userId);
		url.searchParams.set("first", "100");
		if (after) {
			url.searchParams.set("after", after);
		}

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${input.accessToken}`,
				"Client-Id": env.TWITCH_CLIENT_ID,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Could not load moderated Twitch channels: ${response.status}`,
			);
		}

		const body = (await response.json()) as {
			data: {
				broadcaster_id: string;
				broadcaster_login: string;
				broadcaster_name: string;
			}[];
			pagination?: { cursor?: string };
		};

		channels.push(
			...body.data.map((channel) => ({
				broadcasterId: channel.broadcaster_id,
				broadcasterLogin: channel.broadcaster_login,
				broadcasterName: channel.broadcaster_name,
			})),
		);
		after = body.pagination?.cursor;
	} while (after);

	return channels;
}

export async function isChannelFollower(input: {
	broadcasterId: string;
	viewerId: string;
	accessToken: string;
}) {
	const url = new URL("https://api.twitch.tv/helix/channels/followers");
	url.searchParams.set("broadcaster_id", input.broadcasterId);
	url.searchParams.set("user_id", input.viewerId);
	url.searchParams.set("first", "1");

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Could not verify channel follower status: ${response.status}`,
		);
	}

	const body = (await response.json()) as {
		data: { user_id: string }[];
	};

	return body.data.length > 0;
}

export async function isChannelSubscriber(input: {
	broadcasterId: string;
	viewerId: string;
	accessToken: string;
}) {
	const url = new URL("https://api.twitch.tv/helix/subscriptions/user");
	url.searchParams.set("broadcaster_id", input.broadcasterId);
	url.searchParams.set("user_id", input.viewerId);

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Client-Id": env.TWITCH_CLIENT_ID,
		},
	});

	if (response.status === 404) {
		return false;
	}

	if (!response.ok) {
		throw new Error(
			`Could not verify channel subscriber status: ${response.status}`,
		);
	}

	const body = (await response.json()) as {
		data: { user_id: string }[];
	};

	return body.data.length > 0;
}

function helixUserHeaders(accessToken: string) {
	return {
		Authorization: `Bearer ${accessToken}`,
		"Client-Id": env.TWITCH_CLIENT_ID,
		"Content-Type": "application/json",
	};
}

export class TwitchChannelPointsError extends Error {
	readonly httpStatus: number;

	constructor(httpStatus: number, message: string) {
		super(message);
		this.name = "TwitchChannelPointsError";
		this.httpStatus = httpStatus;
	}
}

async function readTwitchHelixError(response: Response) {
	try {
		const body = (await response.json()) as {
			message?: string;
			error?: string;
		};
		return body.message ?? body.error ?? response.statusText;
	} catch {
		return response.statusText;
	}
}

function channelPointsRewardsUrl(broadcasterId: string) {
	const url = new URL(
		"https://api.twitch.tv/helix/channel_points/custom_rewards",
	);
	url.searchParams.set("broadcaster_id", broadcasterId);
	return url;
}

export async function listChannelPointsRewards(input: {
	broadcasterId: string;
	accessToken: string;
}) {
	const url = channelPointsRewardsUrl(input.broadcasterId);
	url.searchParams.set("only_manageable_rewards", "true");
	url.searchParams.set("first", "50");

	const response = await fetch(url, {
		headers: helixUserHeaders(input.accessToken),
	});

	if (!response.ok) {
		const detail = await readTwitchHelixError(response);
		throw new TwitchChannelPointsError(
			response.status,
			`Could not list channel points rewards: ${detail}`,
		);
	}

	const body = (await response.json()) as {
		data: { id: string; title: string }[];
	};
	return body.data;
}

async function updateChannelPointsReward(input: {
	broadcasterId: string;
	accessToken: string;
	rewardId: string;
	title: string;
	cost: number;
}) {
	const url = channelPointsRewardsUrl(input.broadcasterId);
	url.searchParams.set("id", input.rewardId);

	const response = await fetch(url, {
		method: "PATCH",
		headers: helixUserHeaders(input.accessToken),
		body: JSON.stringify({
			title: input.title,
			cost: input.cost,
			is_enabled: true,
		}),
	});

	if (!response.ok) {
		const detail = await readTwitchHelixError(response);
		throw new TwitchChannelPointsError(
			response.status,
			`Could not update channel points reward: ${detail}`,
		);
	}

	const body = (await response.json()) as {
		data: { id: string }[];
	};
	return body.data[0]?.id ?? input.rewardId;
}

async function createChannelPointsReward(input: {
	broadcasterId: string;
	accessToken: string;
	title: string;
	cost: number;
}) {
	const url = channelPointsRewardsUrl(input.broadcasterId);

	const response = await fetch(url, {
		method: "POST",
		headers: helixUserHeaders(input.accessToken),
		body: JSON.stringify({
			title: input.title,
			cost: input.cost,
			is_enabled: true,
		}),
	});

	if (!response.ok) {
		const detail = await readTwitchHelixError(response);
		throw new TwitchChannelPointsError(
			response.status,
			`Could not create channel points reward: ${detail}`,
		);
	}

	const body = (await response.json()) as {
		data: { id: string }[];
	};
	const rewardId = body.data[0]?.id;
	if (!rewardId) {
		throw new TwitchChannelPointsError(
			500,
			"Twitch did not return a custom reward id.",
		);
	}
	return rewardId;
}

export async function upsertChannelPointsReward(input: {
	broadcasterId: string;
	accessToken: string;
	title: string;
	cost: number;
	existingRewardId?: string | null;
}) {
	const rewards = await listChannelPointsRewards({
		broadcasterId: input.broadcasterId,
		accessToken: input.accessToken,
	});
	const rewardByTitle = rewards.find((reward) => reward.title === input.title);
	const storedRewardStillExists =
		input.existingRewardId != null &&
		rewards.some((reward) => reward.id === input.existingRewardId);

	const rewardId = storedRewardStillExists
		? input.existingRewardId
		: (rewardByTitle?.id ?? null);

	if (rewardId) {
		return updateChannelPointsReward({
			broadcasterId: input.broadcasterId,
			accessToken: input.accessToken,
			rewardId,
			title: input.title,
			cost: input.cost,
		});
	}

	return createChannelPointsReward(input);
}

export async function fulfillChannelPointsRedemption(input: {
	broadcasterId: string;
	accessToken: string;
	rewardId: string;
	redemptionId: string;
}) {
	const url = new URL(
		"https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions",
	);
	url.searchParams.set("broadcaster_id", input.broadcasterId);
	url.searchParams.set("reward_id", input.rewardId);
	url.searchParams.set("id", input.redemptionId);

	const response = await fetch(url, {
		method: "PATCH",
		headers: helixUserHeaders(input.accessToken),
		body: JSON.stringify({ status: "FULFILLED" }),
	});

	if (!response.ok) {
		throw new Error(
			`Could not fulfill channel points redemption: ${response.status}`,
		);
	}
}

export async function getAppAccessToken() {
	try {
		return await auth.getAppAccessToken();
	} catch {
		// Fall through to client-credentials fetch.
	}

	const response = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: env.TWITCH_CLIENT_ID,
			client_secret: env.TWITCH_CLIENT_SECRET,
			grant_type: "client_credentials",
		}),
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new Error(
			`Could not get Twitch app access token (${response.status}): ${detail}`,
		);
	}

	const body = (await response.json()) as { access_token?: string };
	if (!body.access_token) {
		throw new Error("Twitch did not return an app access token.");
	}

	return body.access_token;
}
