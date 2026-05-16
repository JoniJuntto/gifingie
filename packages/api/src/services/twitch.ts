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
