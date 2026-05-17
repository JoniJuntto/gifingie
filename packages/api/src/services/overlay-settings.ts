import * as z from "zod";

import {
	MAX_OVERLAY_DISPLAY_SECONDS,
	MAX_OVERLAY_GIF_POSITION_PERCENT,
	MAX_OVERLAY_GIF_SIZE_PERCENT,
	MIN_OVERLAY_DISPLAY_SECONDS,
	MIN_OVERLAY_GIF_POSITION_PERCENT,
	MIN_OVERLAY_GIF_SIZE_PERCENT,
} from "./constants";

export const overlaySettingsInputSchema = z.object({
	gifDisplaySeconds: z
		.number()
		.int()
		.min(MIN_OVERLAY_DISPLAY_SECONDS)
		.max(MAX_OVERLAY_DISPLAY_SECONDS),
	overlayGifXPercent: z
		.number()
		.int()
		.min(MIN_OVERLAY_GIF_POSITION_PERCENT)
		.max(MAX_OVERLAY_GIF_POSITION_PERCENT),
	overlayGifYPercent: z
		.number()
		.int()
		.min(MIN_OVERLAY_GIF_POSITION_PERCENT)
		.max(MAX_OVERLAY_GIF_POSITION_PERCENT),
	overlayGifWidthPercent: z
		.number()
		.int()
		.min(MIN_OVERLAY_GIF_SIZE_PERCENT)
		.max(MAX_OVERLAY_GIF_SIZE_PERCENT),
	overlayGifHeightPercent: z
		.number()
		.int()
		.min(MIN_OVERLAY_GIF_SIZE_PERCENT)
		.max(MAX_OVERLAY_GIF_SIZE_PERCENT),
});
