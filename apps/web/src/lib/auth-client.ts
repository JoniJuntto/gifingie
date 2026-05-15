import { env } from "@my-better-t-app/env/web";
import { createAuthClient } from "better-auth/react";

export function appUrl(path: string) {
	return new URL(path, env.VITE_APP_URL).href;
}

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
});
