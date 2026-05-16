export const MAX_CAPTION_LENGTH = 120;

export function normalizeSubmissionCaption(caption?: string | null) {
	const trimmed = caption?.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, MAX_CAPTION_LENGTH);
}
