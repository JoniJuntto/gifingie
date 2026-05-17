export const SUBMIT_RATE_LIMIT_SECONDS = 30;
export const DUPLICATE_WINDOW_SECONDS = 5 * 60;
export const OVERLAY_BACKLOG_LIMIT = 20;
export const OVERLAY_INITIAL_WINDOW_MINUTES = 30;
export const LIVE_CACHE_SECONDS = 75;
export const VIEWER_ACCESS_CACHE_SECONDS = 90;
export const PAYMENT_CREDIT_TTL_SECONDS = 30 * 60;
export const OVERLAY_DISPLAY_SECONDS = 10;
export const MIN_OVERLAY_DISPLAY_SECONDS = 1;
export const MAX_OVERLAY_DISPLAY_SECONDS = 60;
export const DEFAULT_OVERLAY_GIF_X_PERCENT = 50;
export const DEFAULT_OVERLAY_GIF_Y_PERCENT = 78;
export const DEFAULT_OVERLAY_GIF_WIDTH_PERCENT = 28;
export const DEFAULT_OVERLAY_GIF_HEIGHT_PERCENT = 22;
export const MIN_OVERLAY_GIF_POSITION_PERCENT = 0;
export const MAX_OVERLAY_GIF_POSITION_PERCENT = 100;
export const MIN_OVERLAY_GIF_SIZE_PERCENT = 5;
export const MAX_OVERLAY_GIF_SIZE_PERCENT = 100;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_SOUND_BYTES = 5 * 1024 * 1024;
export const MAX_SOUND_PLAYBACK_SECONDS = 30;
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
] as const;
export const ALLOWED_SOUND_CONTENT_TYPES = [
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	"audio/webm",
] as const;
