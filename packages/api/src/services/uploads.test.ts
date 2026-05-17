import { describe, expect, it } from "vitest";

import { MAX_SOUND_BYTES, MAX_UPLOAD_BYTES } from "./constants";
import {
	isAllowedImageUploadContentType,
	isAllowedSoundUploadContentType,
	validateImageUploadMetadata,
	validateSoundUploadMetadata,
} from "./uploads";

describe("validateImageUploadMetadata", () => {
	it("accepts allowed image types within size limit", () => {
		expect(
			validateImageUploadMetadata({
				contentType: "image/png",
				byteSize: MAX_UPLOAD_BYTES,
			}),
		).toBeNull();
	});

	it("rejects unsupported image types", () => {
		expect(
			validateImageUploadMetadata({
				contentType: "audio/mpeg",
				byteSize: 1024,
			}),
		).toBe("Unsupported image type.");
	});
});

describe("validateSoundUploadMetadata", () => {
	it("accepts allowed audio types within size limit", () => {
		expect(
			validateSoundUploadMetadata({
				contentType: "audio/mpeg",
				byteSize: MAX_SOUND_BYTES,
			}),
		).toBeNull();
	});

	it("rejects image types", () => {
		expect(
			validateSoundUploadMetadata({
				contentType: "image/png",
				byteSize: 1024,
			}),
		).toBe("Unsupported audio type.");
	});

	it("rejects oversized audio", () => {
		expect(
			validateSoundUploadMetadata({
				contentType: "audio/wav",
				byteSize: MAX_SOUND_BYTES + 1,
			}),
		).toBe("Upload must be an audio file up to 5 MB.");
	});
});

describe("content type guards", () => {
	it("detects image and sound MIME types", () => {
		expect(isAllowedImageUploadContentType("image/gif")).toBe(true);
		expect(isAllowedSoundUploadContentType("audio/ogg")).toBe(true);
		expect(isAllowedImageUploadContentType("audio/mpeg")).toBe(false);
		expect(isAllowedSoundUploadContentType("image/gif")).toBe(false);
	});
});
