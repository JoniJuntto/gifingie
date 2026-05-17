import { describe, expect, it } from "vitest";

import {
	MAX_CAPTION_LENGTH,
	captionRequiresReview,
	isCaptionFlagged,
	normalizeCaptionForScreening,
	normalizeSubmissionCaption,
	resolveSubmissionModerationStatus,
} from "./captions";

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

describe("normalizeCaptionForScreening", () => {
	it("lowercases and collapses whitespace", () => {
		expect(normalizeCaptionForScreening("  Hello   Stream  ")).toBe(
			"hello stream",
		);
	});

	it("normalizes common leetspeak", () => {
		expect(normalizeCaptionForScreening("h3ll0")).toBe("hello");
	});
});

describe("isCaptionFlagged", () => {
	it("does not flag clean captions", () => {
		expect(isCaptionFlagged("hello stream")).toBe(false);
	});

	it("flags obvious profanity", () => {
		expect(isCaptionFlagged("what the shit")).toBe(true);
	});

	it("flags leetspeak profanity variants", () => {
		expect(isCaptionFlagged("what the sh1t")).toBe(true);
	});
});

describe("captionRequiresReview", () => {
	it("is false for null captions", () => {
		expect(captionRequiresReview(null)).toBe(false);
	});

	it("is true for flagged captions", () => {
		expect(captionRequiresReview("what the shit")).toBe(true);
	});
});

describe("resolveSubmissionModerationStatus", () => {
	it("forces pending when caption is flagged", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: "what the shit",
				source: "giphy",
				moderateGiphySubmissions: false,
			}),
		).toBe("pending");
	});

	it("keeps giphy approved when moderation is off and caption is clean", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: "nice play",
				source: "giphy",
				moderateGiphySubmissions: false,
			}),
		).toBe("approved");
	});

	it("queues giphy when streamer moderation is enabled", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: "nice play",
				source: "giphy",
				moderateGiphySubmissions: true,
			}),
		).toBe("pending");
	});

	it("queues resend uploads when caption is flagged", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: "what the shit",
				source: "upload",
				moderateGiphySubmissions: false,
			}),
		).toBe("pending");
	});

	it("auto-approves resend uploads when caption is clean", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: "nice play",
				source: "upload",
				moderateGiphySubmissions: false,
			}),
		).toBe("approved");
	});

	it("queues new uploads regardless of caption", () => {
		expect(
			resolveSubmissionModerationStatus({
				caption: null,
				source: "upload",
				moderateGiphySubmissions: false,
				isNewUpload: true,
			}),
		).toBe("pending");
	});
});
