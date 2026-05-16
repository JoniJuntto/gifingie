import { describe, expect, it } from "vitest";

import { isForcedLiveTwitchLogin } from "./live-overrides";
import { buildTwitchThumbnailUrl } from "./twitch-thumbnail";

describe("buildTwitchThumbnailUrl", () => {
	it("replaces Twitch thumbnail size placeholders", () => {
		expect(
			buildTwitchThumbnailUrl(
				"https://static-cdn.jtvnw.net/previews-ttv/live_user_test-{width}x{height}.jpg",
				640,
				360,
			),
		).toBe(
			"https://static-cdn.jtvnw.net/previews-ttv/live_user_test-640x360.jpg",
		);
	});
});

describe("isForcedLiveTwitchLogin", () => {
	it("forces huikkakoodaa live", () => {
		expect(isForcedLiveTwitchLogin("huikkakoodaa")).toBe(true);
	});

	it("matches forced-live logins case-insensitively", () => {
		expect(isForcedLiveTwitchLogin("HuikkaKoodaa")).toBe(true);
	});

	it("does not force other logins live", () => {
		expect(isForcedLiveTwitchLogin("someone-else")).toBe(false);
	});
});
