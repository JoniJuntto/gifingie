import { env } from "@my-better-t-app/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDb() {
	const pool = new Pool({
		host: env.DATABASE_HOST,
		port: Number.parseInt(env.DATABASE_PORT, 10),
		user: env.DATABASE_USER,
		password: env.DATABASE_PASSWORD,
		database: env.DATABASE_NAME,
		ssl: { rejectUnauthorized: false },
	});
	return drizzle(pool, { schema });
}

export const db = createDb();
