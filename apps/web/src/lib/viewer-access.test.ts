import { describe, expect, it } from "vitest";

import {
	canSendGiphyToStreamer,
	canUseCustomUploadsForStreamer,
	getGiphyAccessHint,
	getUploadAccessHint,
} from "./viewer-access";

const streamer = {
	allowCustomUploads: true,
	allowGifSubmissions: true,
	giphyAccess: "everyone" as const,
	uploadAccess: "everyone" as const,
};

describe("viewer-access helpers", () => {
	it("allows anonymous giphy when access is everyone", () => {
		expect(
			canSendGiphyToStreamer(streamer, {
				sessionReady: true,
				isAnonymous: true,
			}),
		).toBe(true);
		expect(getGiphyAccessHint(streamer, true)).toBeNull();
	});

	it("requires sign-in for restricted giphy access", () => {
		expect(
			canSendGiphyToStreamer(
				{ ...streamer, giphyAccess: "followers" },
				{ sessionReady: true, isAnonymous: true },
			),
		).toBe(false);
		expect(
			getGiphyAccessHint(
				{ ...streamer, giphyAccess: "followers" },
				true,
			),
		).toContain("Sign in with Twitch");
	});

	it("blocks custom uploads when disabled", () => {
		expect(
			canUseCustomUploadsForStreamer(
				{ ...streamer, allowCustomUploads: false },
				{ isAnonymous: false },
			),
		).toBe(false);
		expect(
			getUploadAccessHint(
				{ ...streamer, allowCustomUploads: false },
				false,
			),
		).toContain("disabled");
	});
});
