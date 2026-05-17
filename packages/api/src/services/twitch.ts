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
