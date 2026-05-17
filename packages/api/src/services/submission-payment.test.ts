import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pricing-schema", () => ({
	getSubmissionPrice: (
		profile: {
			giphyPriceCurrency: string;
			giphyPriceAmount: number | null;
			uploadPriceCurrency: string;
			uploadPriceAmount: number | null;
		},
		action: "giphy" | "upload",
	) => {
		const currency =
			action === "giphy" ? profile.giphyPriceCurrency : profile.uploadPriceCurrency;
		const amount =
			action === "giphy" ? profile.giphyPriceAmount : profile.uploadPriceAmount;
		if (currency === "none" || !amount) return null;
		return { currency, amount };
	},
}));

vi.mock("./twitch", () => ({
	fulfillChannelPointsRedemption: vi.fn(async () => undefined),
}));

vi.mock("@my-better-t-app/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => ({
						// biome-ignore lint/suspicious/noThenProperty: test mock
						then: (resolve: (value: never[]) => void) => resolve([]),
					}),
				}),
			}),
		}),
	},
}));

import { assertSubmissionPayment } from "./submission-payment";

const baseProfile = {
	id: "profile-1",
	userId: "streamer-user",
	twitchChannelId: "channel-1",
	giphyPriceCurrency: "none" as const,
	giphyPriceAmount: null,
	uploadPriceCurrency: "none" as const,
	uploadPriceAmount: null,
	soundPriceCurrency: "none" as const,
	soundPriceAmount: null,
};

describe("assertSubmissionPayment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("allows free giphy without a credit", async () => {
		await expect(
			assertSubmissionPayment({
				profile: baseProfile,
				action: "giphy",
				viewerUserId: "viewer-1",
			}),
		).resolves.toBeNull();
	});

	it("rejects priced upload without a credit", async () => {
		await expect(
			assertSubmissionPayment({
				profile: {
					...baseProfile,
					uploadPriceCurrency: "channel_points",
					uploadPriceAmount: 500,
				},
				action: "upload",
				viewerUserId: "viewer-1",
			}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: expect.stringContaining("Payment required"),
		});
	});

	it("rejects when credit id is unknown", async () => {
		await expect(
			assertSubmissionPayment({
				profile: {
					...baseProfile,
					giphyPriceCurrency: "bits",
					giphyPriceAmount: 100,
				},
				action: "giphy",
				viewerUserId: "viewer-1",
				paymentCreditId: "missing-credit",
			}),
		).rejects.toBeInstanceOf(TRPCError);
	});
});
