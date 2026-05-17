import { env } from "@my-better-t-app/env/web";
import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export function appUrl(path: string) {
	return new URL(path, env.VITE_APP_URL).href ?? "https://gifingie.huikaton.online";
}

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL ?? "https://gifingie.huikaton.online",
	plugins: [anonymousClient()],
});
