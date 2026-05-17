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

export async function upsertChannelPointsReward(input: {
	broadcasterId: string;
	accessToken: string;
	title: string;
	cost: number;
	existingRewardId?: string | null;
}) {
	if (input.existingRewardId) {
		const url = new URL(
			"https://api.twitch.tv/helix/channel_points/custom_rewards",
		);
		url.searchParams.set("broadcaster_id", input.broadcasterId);
		url.searchParams.set("id", input.existingRewardId);

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
			throw new Error(`Could not update channel points reward: ${response.status}`);
		}

		const body = (await response.json()) as {
			data: { id: string }[];
		};
		return body.data[0]?.id ?? input.existingRewardId;
	}

	const url = new URL(
		"https://api.twitch.tv/helix/channel_points/custom_rewards",
	);
	url.searchParams.set("broadcaster_id", input.broadcasterId);

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
		throw new Error(`Could not create channel points reward: ${response.status}`);
	}

	const body = (await response.json()) as {
		data: { id: string }[];
	};
	const rewardId = body.data[0]?.id;
	if (!rewardId) {
		throw new Error("Twitch did not return a custom reward id.");
	}
	return rewardId;
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
	return auth.getAppAccessToken();
}
