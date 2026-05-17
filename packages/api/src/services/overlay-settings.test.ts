import { describe, expect, it } from "vitest";

import { overlaySettingsInputSchema } from "./overlay-settings";

const validSettings = {
	gifDisplaySeconds: 10,
	overlayGifXPercent: 50,
	overlayGifYPercent: 78,
	overlayGifWidthPercent: 28,
	overlayGifHeightPercent: 22,
};

describe("overlaySettingsInputSchema", () => {
	it("accepts valid overlay playback and layout settings", () => {
		expect(overlaySettingsInputSchema.safeParse(validSettings).success).toBe(
			true,
		);
	});

	it("rejects out-of-range positions", () => {
		expect(
			overlaySettingsInputSchema.safeParse({
				...validSettings,
				overlayGifXPercent: -1,
			}).success,
		).toBe(false);
		expect(
			overlaySettingsInputSchema.safeParse({
				...validSettings,
				overlayGifYPercent: 101,
			}).success,
		).toBe(false);
	});

	it("rejects out-of-range sizes", () => {
		expect(
			overlaySettingsInputSchema.safeParse({
				...validSettings,
				overlayGifWidthPercent: 4,
			}).success,
		).toBe(false);
		expect(
			overlaySettingsInputSchema.safeParse({
				...validSettings,
				overlayGifHeightPercent: 101,
			}).success,
		).toBe(false);
	});
});
