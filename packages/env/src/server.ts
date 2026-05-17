import "./load-env.js";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_HOST: z.string().min(1),
		DATABASE_PORT: z.string().min(1),
		DATABASE_USER: z.string().min(1),
		DATABASE_PASSWORD: z.string().min(1),
		DATABASE_NAME: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		TWITCH_CLIENT_ID: z.string().min(1),
		TWITCH_CLIENT_SECRET: z.string().min(1),
		TWITCH_EVENTSUB_SECRET: z.string().min(10),
		TWITCH_EXTENSION_SECRET: z.string().min(1),
		TWITCH_EXTENSION_CLIENT_ID: z.string().min(1),
		GIPHY_API_KEY: z.string().min(1),
		S3_ENDPOINT: z.url().optional(),
		S3_REGION: z.string().min(1).optional(),
		S3_BUCKET: z.string().min(1).optional(),
		S3_ACCESS_KEY_ID: z.string().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
		S3_DISPLAY_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
		PORT: z.coerce.number().int().positive().default(3000),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
