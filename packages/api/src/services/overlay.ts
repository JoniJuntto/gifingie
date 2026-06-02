import { db } from "@my-better-t-app/db";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { and, asc, eq, gt, gte, isNotNull, isNull, or } from "drizzle-orm";

import {
	DEFAULT_OVERLAY_GIF_HEIGHT_PERCENT,
	DEFAULT_OVERLAY_GIF_WIDTH_PERCENT,
	DEFAULT_OVERLAY_GIF_X_PERCENT,
	DEFAULT_OVERLAY_GIF_Y_PERCENT,
	MAX_OVERLAY_DISPLAY_SECONDS,
	OVERLAY_DISPLAY_SECONDS,
	OVERLAY_INITIAL_WINDOW_MINUTES,
} from "./constants";
import { createSignedDisplayUrl } from "./uploads";

export function buildOverlayAllowedSourceFilters(profile: {
	allowGifSubmissions: boolean;
	allowSoundSubmissions: boolean;
}) {
	const allowedSourceFilters = [];

	if (profile.allowGifSubmissions) {
		allowedSourceFilters.push(
			or(
				eq(gifSubmissions.source, "giphy"),
				and(
					eq(gifSubmissions.source, "upload"),
					isNotNull(gifSubmissions.uploadedAt),
				),
			),
		);
	}

	if (profile.allowSoundSubmissions) {
		allowedSourceFilters.push(
			and(
				eq(gifSubmissions.source, "sound"),
				isNotNull(gifSubmissions.uploadedAt),
			),
		);
	}

	return allowedSourceFilters;
}

export async function getOverlayGifs(
	overlayToken: string,
	options?: { after?: number; preview?: boolean },
) {
	const after = options?.after;
	const preview = options?.preview ?? false;
	const [profile] = await db
		.select()
		.from(streamerProfiles)
		.where(
			and(
				eq(streamerProfiles.overlayToken, overlayToken),
				eq(streamerProfiles.isEnrolled, true),
			),
		)
		.limit(1);

	if (!profile) {
		return null;
	}

	const allowedSourceFilters = buildOverlayAllowedSourceFilters(profile);

	if (allowedSourceFilters.length === 0) {
		return {
			gifs: [],
			settings: {
				gifDisplaySeconds:
					profile.gifDisplaySeconds ?? OVERLAY_DISPLAY_SECONDS,
				overlayGifXPercent:
					profile.overlayGifXPercent ?? DEFAULT_OVERLAY_GIF_X_PERCENT,
				overlayGifYPercent:
					profile.overlayGifYPercent ?? DEFAULT_OVERLAY_GIF_Y_PERCENT,
				overlayGifWidthPercent:
					profile.overlayGifWidthPercent ?? DEFAULT_OVERLAY_GIF_WIDTH_PERCENT,
				overlayGifHeightPercent:
					profile.overlayGifHeightPercent ??
					DEFAULT_OVERLAY_GIF_HEIGHT_PERCENT,
			},
		};
	}

	const gifDisplaySeconds = Math.min(
		profile.gifDisplaySeconds ?? OVERLAY_DISPLAY_SECONDS,
		MAX_OVERLAY_DISPLAY_SECONDS,
	);
	const recentDisplayedCutoff = new Date(
		Date.now() - gifDisplaySeconds * 1000,
	);
	const displayFilter = preview
		? or(
				isNull(gifSubmissions.displayedAt),
				gte(gifSubmissions.displayedAt, recentDisplayedCutoff),
			)
		: isNull(gifSubmissions.displayedAt);

	const filters = [
		eq(gifSubmissions.streamerProfileId, profile.id),
		displayFilter,
		eq(gifSubmissions.moderationStatus, "approved"),
		or(...allowedSourceFilters),
	];

	if (typeof after === "number") {
		filters.push(gt(gifSubmissions.id, after));
	} else {
		filters.push(
			gte(
				gifSubmissions.createdAt,
				new Date(Date.now() - OVERLAY_INITIAL_WINDOW_MINUTES * 60 * 1000),
			),
		);
	}

	const gifs = await db
		.select({
			id: gifSubmissions.id,
			source: gifSubmissions.source,
			giphyId: gifSubmissions.giphyId,
			gifUrl: gifSubmissions.gifUrl,
			previewUrl: gifSubmissions.previewUrl,
			title: gifSubmissions.title,
			caption: gifSubmissions.caption,
			s3Key: gifSubmissions.s3Key,
			durationMs: gifSubmissions.durationMs,
			createdAt: gifSubmissions.createdAt,
			displayedAt: gifSubmissions.displayedAt,
		})
		.from(gifSubmissions)
		.where(and(...filters))
		.orderBy(asc(gifSubmissions.id))
		.limit(25);

	const visibleGifs = await Promise.all(
		gifs.map(async (gif) => {
			const mediaUrl =
				(gif.source === "upload" || gif.source === "sound") && gif.s3Key
					? await createSignedDisplayUrl(gif.s3Key)
					: (gif.gifUrl ?? "");

			return {
				id: gif.id,
				source: gif.source,
				giphyId: gif.giphyId,
				gifUrl: mediaUrl,
				previewUrl: gif.previewUrl,
				title: gif.title,
				caption: gif.caption,
				durationMs: gif.durationMs,
				createdAt: gif.createdAt,
				displayedAt: gif.displayedAt,
			};
		}),
	);

	return {
		gifs: visibleGifs.filter((gif) => gif.gifUrl.length > 0),
		settings: {
			gifDisplaySeconds: profile.gifDisplaySeconds ?? OVERLAY_DISPLAY_SECONDS,
			overlayGifXPercent:
				profile.overlayGifXPercent ?? DEFAULT_OVERLAY_GIF_X_PERCENT,
			overlayGifYPercent:
				profile.overlayGifYPercent ?? DEFAULT_OVERLAY_GIF_Y_PERCENT,
			overlayGifWidthPercent:
				profile.overlayGifWidthPercent ?? DEFAULT_OVERLAY_GIF_WIDTH_PERCENT,
			overlayGifHeightPercent:
				profile.overlayGifHeightPercent ?? DEFAULT_OVERLAY_GIF_HEIGHT_PERCENT,
		},
	};
}

export async function ackOverlayGif(
	overlayToken: string,
	submissionId: number,
) {
	const [profile] = await db
		.select({ id: streamerProfiles.id })
		.from(streamerProfiles)
		.where(
			and(
				eq(streamerProfiles.overlayToken, overlayToken),
				eq(streamerProfiles.isEnrolled, true),
			),
		)
		.limit(1);

	if (!profile) {
		return null;
	}

	const [submission] = await db
		.update(gifSubmissions)
		.set({ displayedAt: new Date() })
		.where(
			and(
				eq(gifSubmissions.id, submissionId),
				eq(gifSubmissions.streamerProfileId, profile.id),
				isNull(gifSubmissions.displayedAt),
			),
		)
		.returning({ id: gifSubmissions.id });

	return submission ?? null;
}
