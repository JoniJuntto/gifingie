export function isExtensionOrigin(origin: string | null): boolean {
	if (!origin) return false;
	return (
		origin === "https://localhost.twitch.tv" ||
		/^https:\/\/[a-z0-9-]+\.ext-twitch\.tv$/.test(origin)
	);
}

export function addExtensionCorsHeaders(
	origin: string | null,
	headers: Record<string, string>,
): void {
	if (!isExtensionOrigin(origin) || !origin) return;
	headers["access-control-allow-origin"] = origin;
	headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
	headers["access-control-allow-headers"] = "content-type, authorization";
}
