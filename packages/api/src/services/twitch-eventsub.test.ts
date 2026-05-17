import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@my-better-t-app/env/server", () => ({
	env: {
		TWITCH_CLIENT_ID: "client-id",
		TWITCH_CLIENT_SECRET: "secret",
		TWITCH_EVENTSUB_SECRET: "test-eventsub-secret",
		BETTER_AUTH_URL: "http://localhost:3000",
	},
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

vi.mock("./twitch", () => ({
	getAppAccessToken: vi.fn(async () => "app-token"),
}));

vi.mock("./submission-payment", () => ({
	insertPaymentCredit: vi.fn(async () => null),
}));

import { verifyEventSubSignature } from "./twitch-eventsub";

describe("verifyEventSubSignature", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("accepts a valid signature", () => {
		const messageId = "msg-1";
		const timestamp = "1234567890";
		const body = '{"test":true}';
		const message = messageId + timestamp + body;
		const signature =
			"sha256=" +
			createHmac("sha256", "test-eventsub-secret")
				.update(message)
				.digest("hex");

		expect(() =>
			verifyEventSubSignature({
				messageId,
				timestamp,
				body,
				signature,
			}),
		).not.toThrow();
	});

	it("rejects an invalid signature", () => {
		expect(() =>
			verifyEventSubSignature({
				messageId: "msg-1",
				timestamp: "1234567890",
				body: "{}",
				signature: "sha256=deadbeef",
			}),
		).toThrow("Invalid EventSub signature.");
	});
});
