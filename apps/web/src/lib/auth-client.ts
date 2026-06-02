import { env } from "@my-better-t-app/env/web";
import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const DEFAULT_APP_URL =
	import.meta.env.VITE_APP_URL ?? "https://gifingie.huikaton.online";

function appBaseUrl() {
	return (
		env.VITE_APP_URL ??
		(typeof window !== "undefined" ? window.location.origin : DEFAULT_APP_URL)
	);
}

export function appUrl(path: string) {
	return new URL(path, appBaseUrl()).href;
}

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL ?? "https://gifingie.huikaton.online",
	plugins: [anonymousClient()],
});
