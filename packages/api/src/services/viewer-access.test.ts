import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertViewerAccess } from "./viewer-access";

const state = vi.hoisted(() => ({
	accounts: [] as {
		userId: string;
		accountId: string;
		accessToken: string | null;
		scope: string | null;
	}[],
	followerResult: true,
	subscriberResult: true,
	accountLookupOrder: [] as string[],
}));

vi.mock("@my-better-t-app/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => {
						const query = {
							// biome-ignore lint/suspicious/noThenProperty: test mock
							then: (
								resolve: (
									value: typeof state.accounts,
								) => void,
							) => {
								const userId = state.accountLookupOrder.shift();
								const rows = userId
									? state.accounts.filter(
											(account) => account.userId === userId,
										)
									: state.accounts;
								resolve(rows);
							},
						};
						return query;
					},
				}),
			}),
		}),
	},
}));

vi.mock("./twitch", () => ({
	isChannelFollower: vi.fn(async () => state.followerResult),
	isChannelSubscriber: vi.fn(async () => state.subscriberResult),
}));

const baseProfile = {
	id: "profile-1",
	userId: "streamer-user",
	twitchChannelId: "channel-1",
	giphyAccess: "everyone" as const,
	uploadAccess: "everyone" as const,
	allowCustomUploads: true,
};

describe("assertViewerAccess", () => {
	beforeEach(() => {
		state.accounts = [];
		state.followerResult = true;
		state.subscriberResult = true;
		state.accountLookupOrder = [];
	});

	it("allows anonymous giphy when access is everyone", async () => {
		await expect(
			assertViewerAccess({
				profile: baseProfile,
				action: "giphy",
				viewerUserId: "viewer-1",
				viewerIsAnonymous: true,
			}),
		).resolves.toBeUndefined();
	});

	it("rejects anonymous viewers when giphy requires followers", async () => {
		await expect(
			assertViewerAccess({
				profile: { ...baseProfile, giphyAccess: "followers" },
				action: "giphy",
				viewerUserId: "viewer-1",
				viewerIsAnonymous: true,
			}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Sign in with Twitch to send GIFs to this channel.",
		});
	});

	it("rejects uploads when custom uploads are disabled", async () => {
		await expect(
			assertViewerAccess({
				profile: { ...baseProfile, allowCustomUploads: false },
				action: "upload",
				viewerUserId: "viewer-1",
				viewerIsAnonymous: false,
			}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Custom uploads are disabled for this channel.",
		});
	});

	it("checks follower status for signed-in viewers", async () => {
		state.accountLookupOrder = ["viewer-1", "streamer-user"];
		state.accounts = [
			{
				userId: "viewer-1",
				accountId: "viewer-twitch",
				accessToken: "viewer-token",
				scope: null,
			},
			{
				userId: "streamer-user",
				accountId: "streamer-twitch",
				accessToken: "streamer-token",
				scope: null,
			},
		];
		state.followerResult = false;

		await expect(
			assertViewerAccess({
				profile: { ...baseProfile, giphyAccess: "followers" },
				action: "giphy",
				viewerUserId: "viewer-1",
				viewerIsAnonymous: false,
			}),
		).rejects.toBeInstanceOf(TRPCError);
	});

	it("checks subscriber status when required", async () => {
		const { isChannelSubscriber } = await import("./twitch");

		state.accountLookupOrder = ["viewer-1", "streamer-user"];
		state.accounts = [
			{
				userId: "viewer-1",
				accountId: "viewer-twitch",
				accessToken: "viewer-token",
				scope: null,
			},
			{
				userId: "streamer-user",
				accountId: "streamer-twitch",
				accessToken: "streamer-token",
				scope: "channel:read:subscriptions",
			},
		];
		state.subscriberResult = false;

		await expect(
			assertViewerAccess({
				profile: { ...baseProfile, uploadAccess: "subscribers" },
				action: "upload",
				viewerUserId: "viewer-1",
				viewerIsAnonymous: false,
			}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		expect(isChannelSubscriber).toHaveBeenCalled();
	});
});
