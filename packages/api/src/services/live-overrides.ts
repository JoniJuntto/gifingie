const FORCE_LIVE_TWITCH_LOGINS = new Set(["huikkakoodaa"]);

export function isForcedLiveTwitchLogin(login: string) {
	return FORCE_LIVE_TWITCH_LOGINS.has(login.toLowerCase());
}
