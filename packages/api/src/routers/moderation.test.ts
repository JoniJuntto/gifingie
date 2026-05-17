import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderationRouter } from "./moderation";

const state = vi.hoisted(() => ({
	account: null as null | {
		id: string;
		accountId: string;
		providerId: string;
		userId: string;
		accessToken: string | null;
		scope: string | null;
	},
	profiles: [] as {
		id: string;
		twitchChannelId: string;
		twitchChannelLogin: string;
		twitchDisplayName: string;
		twitchAvatarUrl: string | null;
		isEnrolled: boolean;
	}[],
	submissions: [] as {
		id: number;
		streamerProfileId: string;
		source: "giphy" | "upload";
		giphyId: string | null;
		gifUrl: string | null;
		previewUrl: string | null;
		title: string;
		caption: string | null;
		s3Key: string | null;
		contentType: string | null;
		byteSize: number | null;
		originalFilename: string | null;
		moderationStatus: "pending" | "approved" | "rejected";
		uploadedAt: Date | null;
		createdAt: Date;
	}[],
	updateCalls: [] as string[],
	moderatedChannels: [] as { broadcasterId: string }[],
}));

function tableName(table: unknown) {
	const symbol = Object.getOwnPropertySymbols(table as object).find(
		(candidate) => String(candidate) === "Symbol(drizzle:Name)",
	);
	return symbol ? (table as Record<symbol, string>)[symbol] : "";
}

function rowsForTable(table: unknown) {
	switch (tableName(table)) {
		case "account":
			return state.account ? [state.account] : [];
		case "streamer_profiles":
			return state.profiles.filter((profile) => profile.isEnrolled);
		case "gif_submissions":
			return state.submissions.filter(
				(submission) =>
					submission.moderationStatus === "pending" &&
					(submission.source === "giphy" || submission.uploadedAt),
			);
		default:
			return [];
	}
}

function createSelectQuery(table: unknown) {
	const query = {
		where: () => query,
		orderBy: () => query,
		limit: (limit: number) => rowsForTable(table).slice(0, limit),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are awaitable in these router paths.
		then: (resolve: (value: unknown[]) => void) => resolve(rowsForTable(table)),
	};
	return query;
}

vi.mock("@my-better-t-app/db", () => ({
	db: {
		select: () => ({
			from: (table: unknown) => createSelectQuery(table),
		}),
		update: () => ({
			set: (values: { moderationStatus?: "approved" | "rejected" }) => ({
				where: () => ({
					returning: () => {
						if (!values.moderationStatus) return [];
						const submission = state.submissions.find(
							(candidate) => candidate.moderationStatus === "pending",
						);
						if (!submission) return [];
						submission.moderationStatus = values.moderationStatus;
						state.updateCalls.push(values.moderationStatus);
						return [submission];
					},
				}),
			}),
		}),
	},
}));

vi.mock("@my-better-t-app/env/server", () => ({
	env: {
		TWITCH_CLIENT_ID: "client-id",
	},
}));

vi.mock("../services/twitch", () => ({
	getModeratedChannelsForUser: vi.fn(() => state.moderatedChannels),
	getLiveStreamsByUserIds: vi.fn(async () => []),
	getTwitchUserById: vi.fn(async () => null),
	isUserLive: vi.fn(async () => false),
}));

vi.mock("../services/uploads", () => ({
	createSignedDisplayUrl: vi.fn(async () => "https://example.com/signed.gif"),
}));

const channelProfileId = "00000000-0000-4000-8000-000000000001";
const otherProfileId = "00000000-0000-4000-8000-000000000002";

function callerFor(userId = "user-1") {
	return moderationRouter.createCaller({
		auth: null,
		session: {
			user: { id: userId },
		},
	} as never);
}

function seedProfile(overrides: Partial<(typeof state.profiles)[number]> = {}) {
	state.profiles = [
		{
			id: channelProfileId,
			twitchChannelId: "channel-1",
			twitchChannelLogin: "streamer",
			twitchDisplayName: "Streamer",
			twitchAvatarUrl: null,
			isEnrolled: true,
			...overrides,
		},
	];
}

function seedTwitchAccount(scope = "user:read:moderated_channels") {
	state.account = {
		id: "account-1",
		accountId: "mod-user-1",
		providerId: "twitch",
		userId: "user-1",
		accessToken: "token-1",
		scope,
	};
}

function seedPendingSubmission(
	overrides: Partial<(typeof state.submissions)[number]> = {},
) {
	state.submissions = [
		{
			id: 1,
			streamerProfileId: channelProfileId,
			source: "giphy",
			giphyId: "gif-1",
			gifUrl: "https://example.com/gif.gif",
			previewUrl: "https://example.com/preview.gif",
			title: "A GIF",
			caption: null,
			s3Key: null,
			contentType: null,
			byteSize: null,
			originalFilename: null,
			moderationStatus: "pending",
			uploadedAt: null,
			createdAt: new Date("2026-05-17T00:00:00.000Z"),
			...overrides,
		},
	];
}

describe("moderationRouter", () => {
	beforeEach(() => {
		state.account = null;
		state.profiles = [];
		state.submissions = [];
		state.updateCalls = [];
		state.moderatedChannels = [];
	});

	it("asks users without a Twitch account to reconnect", async () => {
		await expect(callerFor().myChannels()).resolves.toEqual({
			needsReconnect: true,
			channels: [],
		});
	});

	it("asks users without the moderated channels scope to reconnect", async () => {
		seedTwitchAccount("user:read:email openid");

		await expect(callerFor().myChannels()).resolves.toEqual({
			needsReconnect: true,
			channels: [],
		});
	});

	it("lists enrolled channels moderated by the signed-in Twitch user", async () => {
		seedTwitchAccount();
		seedProfile();
		state.moderatedChannels = [{ broadcasterId: "channel-1" }];

		await expect(callerFor().myChannels()).resolves.toEqual({
			needsReconnect: false,
			channels: [
				expect.objectContaining({
					id: channelProfileId,
					twitchChannelId: "channel-1",
				}),
			],
		});
	});

	it("blocks pending queue access for channels the user does not moderate", async () => {
		seedTwitchAccount();
		seedProfile();
		state.moderatedChannels = [{ broadcasterId: "someone-else" }];

		await expect(
			callerFor().pendingSubmissions({
				streamerProfileId: channelProfileId,
			}),
		).rejects.toBeInstanceOf(TRPCError);
	});

	it("lets a Twitch moderator list pending submissions", async () => {
		seedTwitchAccount();
		seedProfile();
		seedPendingSubmission();
		state.moderatedChannels = [{ broadcasterId: "channel-1" }];

		await expect(
			callerFor().pendingSubmissions({
				streamerProfileId: channelProfileId,
			}),
		).resolves.toEqual([
			expect.objectContaining({
				id: 1,
				moderationStatus: "pending",
				title: "A GIF",
			}),
		]);
	});

	it("lets a Twitch moderator approve pending submissions", async () => {
		seedTwitchAccount();
		seedProfile();
		seedPendingSubmission();
		state.moderatedChannels = [{ broadcasterId: "channel-1" }];

		await expect(
			callerFor().approveSubmission({
				streamerProfileId: channelProfileId,
				submissionId: 1,
			}),
		).resolves.toEqual(
			expect.objectContaining({ moderationStatus: "approved" }),
		);
		expect(state.updateCalls).toEqual(["approved"]);
	});

	it("lets a Twitch moderator reject pending submissions", async () => {
		seedTwitchAccount();
		seedProfile();
		seedPendingSubmission();
		state.moderatedChannels = [{ broadcasterId: "channel-1" }];

		await expect(
			callerFor().rejectSubmission({
				streamerProfileId: channelProfileId,
				submissionId: 1,
			}),
		).resolves.toEqual(
			expect.objectContaining({ moderationStatus: "rejected" }),
		);
		expect(state.updateCalls).toEqual(["rejected"]);
	});

	it("does not update submissions for channels the user does not moderate", async () => {
		seedTwitchAccount();
		seedProfile({ id: otherProfileId, twitchChannelId: "channel-2" });
		seedPendingSubmission({ streamerProfileId: otherProfileId });
		state.moderatedChannels = [{ broadcasterId: "channel-1" }];

		await expect(
			callerFor().approveSubmission({
				streamerProfileId: otherProfileId,
				submissionId: 1,
			}),
		).rejects.toBeInstanceOf(TRPCError);
		expect(state.updateCalls).toEqual([]);
	});
});
