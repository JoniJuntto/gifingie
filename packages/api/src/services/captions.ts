import { Filter } from "bad-words";

export const MAX_CAPTION_LENGTH = 120;

const profanityFilter = new Filter();

const LEETSPEAK_REPLACEMENTS: Record<string, string> = {
	"0": "o",
	"1": "i",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"@": "a",
	"$": "s",
};

export function normalizeSubmissionCaption(caption?: string | null) {
	const trimmed = caption?.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, MAX_CAPTION_LENGTH);
}

export function normalizeCaptionForScreening(text: string) {
	const lowercased = text.toLowerCase();
	const withoutSeparators = lowercased.replace(/[^a-z0-9@$]+/g, " ");
	const deleeted = [...withoutSeparators]
		.map((char) => LEETSPEAK_REPLACEMENTS[char] ?? char)
		.join("");

	return deleeted.replace(/\s+/g, " ").trim();
}

export function isCaptionFlagged(text: string) {
	const normalized = normalizeCaptionForScreening(text);
	if (!normalized) return false;

	return profanityFilter.isProfane(normalized);
}

export function captionRequiresReview(caption: string | null) {
	return caption !== null && isCaptionFlagged(caption);
}

export function resolveSubmissionModerationStatus(input: {
	caption: string | null;
	source: "giphy" | "upload" | "sound";
	moderateGiphySubmissions: boolean;
	isNewUpload?: boolean;
}) {
	if (input.caption && isCaptionFlagged(input.caption)) {
		return "pending" as const;
	}

	if (
		(input.source === "upload" || input.source === "sound") &&
		input.isNewUpload
	) {
		return "pending" as const;
	}

	if (input.source === "giphy" && input.moderateGiphySubmissions) {
		return "pending" as const;
	}

	return "approved" as const;
}
