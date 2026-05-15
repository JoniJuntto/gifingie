import { env } from "@my-better-t-app/env/server";
import { z } from "zod";

export const giphyGifInputSchema = z.object({
	id: z.string().min(1),
	title: z.string().default("Untitled GIF"),
	gifUrl: z.url(),
	previewUrl: z.url().optional(),
});

export type GiphyGifInput = z.infer<typeof giphyGifInputSchema>;

type GiphyImage = {
	url?: string;
	webp?: string;
};

type GiphyResult = {
	id: string;
	title?: string;
	images?: {
		original?: GiphyImage;
		fixed_height?: GiphyImage;
		fixed_width?: GiphyImage;
		downsized_medium?: GiphyImage;
		preview_gif?: GiphyImage;
	};
};

export type NormalizedGiphyGif = {
	id: string;
	title: string;
	gifUrl: string;
	previewUrl?: string;
};

function normalizeGiphyResult(result: GiphyResult): NormalizedGiphyGif | null {
	const gifUrl =
		result.images?.original?.url ??
		result.images?.downsized_medium?.url ??
		result.images?.fixed_height?.url ??
		result.images?.fixed_width?.url;

	if (!result.id || !gifUrl) {
		return null;
	}

	return {
		id: result.id,
		title: result.title?.trim() || "Untitled GIF",
		gifUrl,
		previewUrl:
			result.images?.fixed_height?.url ?? result.images?.preview_gif?.url,
	};
}

export async function searchGiphy(query: string) {
	const params = new URLSearchParams({
		api_key: env.GIPHY_API_KEY,
		q: query,
		limit: "24",
		rating: "pg-13",
		lang: "en",
		bundle: "messaging_non_clips",
	});

	const response = await fetch(
		`https://api.giphy.com/v1/gifs/search?${params.toString()}`,
	);
	if (!response.ok) {
		throw new Error(`GIPHY search failed with ${response.status}`);
	}

	const payload = (await response.json()) as { data?: GiphyResult[] };
	return (payload.data ?? [])
		.map(normalizeGiphyResult)
		.filter((gif): gif is NormalizedGiphyGif => !!gif);
}

export function normalizeSubmittedGif(input: GiphyGifInput) {
	return giphyGifInputSchema.parse(input);
}
