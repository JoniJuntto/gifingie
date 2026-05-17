import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import type { streamerProfiles } from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { VIEWER_ACCESS_CACHE_SECONDS } from "./constants";
import {
	isChannelFollower,
	isChannelSubscriber,
} from "./twitch";

export type ViewerAccessLevel = "everyone" | "followers" | "subscribers";
export type ViewerAccessAction = "giphy" | "upload";

export const TWITCH_SUBSCRIPTIONS_SCOPE = "channel:read:subscriptions";

type StreamerProfileForAccess = Pick<
	typeof streamerProfiles.$inferSelect,
	| "id"
	| "userId"
	| "twitchChannelId"
	| "giphyAccess"
	| "uploadAccess"
	| "allowCustomUploads"
>;

const accessCache = new Map<
	string,
	{ expiresAt: number; allowed: boolean }
>();

function cacheKey(
	streamerProfileId: string,
	viewerTwitchId: string,
	check: "followers" | "subscribers",
) {
	return `${streamerProfileId}:${viewerTwitchId}:${check}`;
}

function readCache(key: string) {
	const cached = accessCache.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		accessCache.delete(key);
		return null;
	}
	return cached.allowed;
}

function writeCache(key: string, allowed: boolean) {
	accessCache.set(key, {
		allowed,
		expiresAt: Date.now() + VIEWER_ACCESS_CACHE_SECONDS * 1000,
	});
}

export function hasSubscriptionsScope(scope: string | null) {
	return Boolean(
		scope?.split(/[\s,]+/).includes(TWITCH_SUBSCRIPTIONS_SCOPE),
	);
}

async function getTwitchAccountForUser(userId: string) {
	const [twitchAccount] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
		.limit(1);

	return twitchAccount ?? null;
}

function requiredAccess(
	profile: StreamerProfileForAccess,
	action: ViewerAccessAction,
): ViewerAccessLevel {
	return action === "giphy" ? profile.giphyAccess : profile.uploadAccess;
}

async function verifyHelixAccess(input: {
	profile: StreamerProfileForAccess;
	viewerUserId: string;
	action: ViewerAccessAction;
	required: Exclude<ViewerAccessLevel, "everyone">;
}) {
	const viewerAccount = await getTwitchAccountForUser(input.viewerUserId);
	if (!viewerAccount?.accessToken || !viewerAccount.accountId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Sign in with Twitch to send GIFs to this channel.",
		});
	}

	const streamerAccount = await getTwitchAccountForUser(input.profile.userId);
	if (!streamerAccount?.accessToken) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Streamer must reconnect Twitch to verify viewer access.",
		});
	}

	if (
		input.required === "subscribers" &&
		!hasSubscriptionsScope(streamerAccount.scope)
	) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Streamer must reconnect Twitch to verify subscriptions.",
		});
	}

	const key = cacheKey(
		input.profile.id,
		viewerAccount.accountId,
		input.required,
	);
	const cached = readCache(key);
	if (cached !== null) {
		if (!cached) {
			throw accessDeniedError(input.required, input.action);
		}
		return;
	}

	let allowed = false;
	if (input.required === "followers") {
		allowed = await isChannelFollower({
			broadcasterId: input.profile.twitchChannelId,
			viewerId: viewerAccount.accountId,
			accessToken: streamerAccount.accessToken,
		});
	} else {
		allowed = await isChannelSubscriber({
			broadcasterId: input.profile.twitchChannelId,
			viewerId: viewerAccount.accountId,
			accessToken: streamerAccount.accessToken,
		});
	}

	writeCache(key, allowed);

	if (!allowed) {
		throw accessDeniedError(input.required, input.action);
	}
}

function accessDeniedError(
	required: Exclude<ViewerAccessLevel, "everyone">,
	action: ViewerAccessAction,
) {
	const noun = action === "upload" ? "upload images to" : "send GIFs to";
	if (required === "followers") {
		return new TRPCError({
			code: "FORBIDDEN",
			message: `You must follow this channel to ${noun} this channel.`,
		});
	}

	return new TRPCError({
		code: "FORBIDDEN",
		message: `You must be subscribed to ${noun} this channel.`,
	});
}

export async function assertViewerAccess(input: {
	profile: StreamerProfileForAccess;
	action: ViewerAccessAction;
	viewerUserId: string;
	viewerIsAnonymous: boolean;
}) {
	if (input.action === "upload" && !input.profile.allowCustomUploads) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Custom uploads are disabled for this channel.",
		});
	}

	const required = requiredAccess(input.profile, input.action);

	if (required === "everyone") {
		if (input.action === "upload" && input.viewerIsAnonymous) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Sign in with Twitch to upload images to this channel.",
			});
		}
		return;
	}

	if (input.viewerIsAnonymous) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Sign in with Twitch to send GIFs to this channel.",
		});
	}

	await verifyHelixAccess({
		profile: input.profile,
		viewerUserId: input.viewerUserId,
		action: input.action,
		required,
	});
}
