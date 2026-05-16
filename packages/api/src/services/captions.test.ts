import { describe, expect, it } from "vitest";

import { MAX_CAPTION_LENGTH, normalizeSubmissionCaption } from "./captions";

describe("normalizeSubmissionCaption", () => {
	it("stores empty captions as null", () => {
		expect(normalizeSubmissionCaption()).toBeNull();
		expect(normalizeSubmissionCaption("   ")).toBeNull();
	});

	it("trims captions", () => {
		expect(normalizeSubmissionCaption("  hello stream  ")).toBe("hello stream");
	});

	it("caps captions to the overlay-safe length", () => {
		const caption = "a".repeat(MAX_CAPTION_LENGTH + 10);

		expect(normalizeSubmissionCaption(caption)).toHaveLength(
			MAX_CAPTION_LENGTH,
		);
	});
});
