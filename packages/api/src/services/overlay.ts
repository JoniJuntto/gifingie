import { db } from "@my-better-t-app/db";
import {
	gifSubmissions,
	streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { and, asc, eq, gt, gte, isNotNull, isNull, or } from "drizzle-orm";

import {
	OVERLAY_DISPLAY_SECONDS,
	OVERLAY_INITIAL_WINDOW_MINUTES,
} from "./constants";
import { createSignedDisplayUrl } from "./uploads";

export async function getOverlayGifs(overlayToken: string, after?: number) {
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

	const filters = [
		eq(gifSubmissions.streamerProfileId, profile.id),
		isNull(gifSubmissions.displayedAt),
		eq(gifSubmissions.moderationStatus, "approved"),
		or(
			eq(gifSubmissions.source, "giphy"),
			isNotNull(gifSubmissions.uploadedAt),
		),
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
			createdAt: gifSubmissions.createdAt,
			displayedAt: gifSubmissions.displayedAt,
		})
		.from(gifSubmissions)
		.where(and(...filters))
		.orderBy(asc(gifSubmissions.id))
		.limit(25);

	const visibleGifs = await Promise.all(
		gifs.map(async (gif) => ({
			id: gif.id,
			giphyId: gif.giphyId,
			gifUrl:
				gif.source === "upload" && gif.s3Key
					? await createSignedDisplayUrl(gif.s3Key)
					: (gif.gifUrl ?? ""),
			previewUrl: gif.previewUrl,
			title: gif.title,
			caption: gif.caption,
			createdAt: gif.createdAt,
			displayedAt: gif.displayedAt,
		})),
	);

	return {
		gifs: visibleGifs.filter((gif) => gif.gifUrl.length > 0),
		settings: {
			gifDisplaySeconds: profile.gifDisplaySeconds ?? OVERLAY_DISPLAY_SECONDS,
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
