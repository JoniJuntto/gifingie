import { describe, expect, it } from "vitest";

import { buildOverlayAllowedSourceFilters } from "./overlay";

describe("buildOverlayAllowedSourceFilters", () => {
	it("includes gif paths when gif submissions are allowed", () => {
		const filters = buildOverlayAllowedSourceFilters({
			allowGifSubmissions: true,
			allowSoundSubmissions: false,
		});

		expect(filters).toHaveLength(1);
	});

	it("includes sound path when sound submissions are allowed", () => {
		const filters = buildOverlayAllowedSourceFilters({
			allowGifSubmissions: false,
			allowSoundSubmissions: true,
		});

		expect(filters).toHaveLength(1);
	});

	it("returns both filters when gif and sound are allowed", () => {
		const filters = buildOverlayAllowedSourceFilters({
			allowGifSubmissions: true,
			allowSoundSubmissions: true,
		});

		expect(filters).toHaveLength(2);
	});

	it("returns no filters when both submission types are disabled", () => {
		const filters = buildOverlayAllowedSourceFilters({
			allowGifSubmissions: false,
			allowSoundSubmissions: false,
		});

		expect(filters).toHaveLength(0);
	});
});
