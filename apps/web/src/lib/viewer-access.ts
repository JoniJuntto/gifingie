export type ViewerAccessLevel = "everyone" | "followers" | "subscribers";

export type StreamerAccessSettings = {
	allowCustomUploads?: boolean;
	allowGifSubmissions?: boolean;
	allowSoundSubmissions?: boolean;
	giphyAccess?: ViewerAccessLevel;
	uploadAccess?: ViewerAccessLevel;
};

export function getGiphyAccessHint(
	streamer: StreamerAccessSettings,
	isAnonymous: boolean,
): string | null {
	if (streamer.allowGifSubmissions === false) {
		return "This channel is not accepting GIF submissions.";
	}

	const level = streamer.giphyAccess ?? "everyone";
	if (level === "everyone") return null;
	if (isAnonymous) {
		return "Sign in with Twitch to send GIFs to this channel.";
	}
	return null;
}

export function getUploadAccessHint(
	streamer: StreamerAccessSettings,
	isAnonymous: boolean,
): string | null {
	if (streamer.allowCustomUploads === false) {
		return "Custom uploads are disabled for this channel.";
	}
	if (streamer.allowGifSubmissions === false) {
		return "This channel is not accepting GIF submissions.";
	}
	if (isAnonymous) {
		return "Sign in with Twitch to browse and send custom uploads.";
	}

	const level = streamer.uploadAccess ?? "everyone";
	if (level === "followers") {
		return "Only followers can upload images to this channel.";
	}
	if (level === "subscribers") {
		return "Only subscribers can upload images to this channel.";
	}
	return null;
}

export function canSendGiphyToStreamer(
	streamer: StreamerAccessSettings,
	input: { sessionReady: boolean; isAnonymous: boolean },
): boolean {
	if (!input.sessionReady || streamer.allowGifSubmissions === false) {
		return false;
	}
	const level = streamer.giphyAccess ?? "everyone";
	if (level === "everyone") return true;
	return !input.isAnonymous;
}

export function canUseCustomUploadsForStreamer(
	streamer: StreamerAccessSettings,
	input: { isAnonymous: boolean },
): boolean {
	if (
		streamer.allowCustomUploads === false ||
		streamer.allowGifSubmissions === false ||
		input.isAnonymous
	) {
		return false;
	}
	return true;
}
