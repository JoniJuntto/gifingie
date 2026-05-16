import { defineConfig } from 'drizzle-kit';
import { env } from '@my-better-t-app/env/server';

export default defineConfig({
  out: './src/migrations',
  schema: ['./src/schema/*.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    host: env.DATABASE_HOST,
    port: parseInt(env.DATABASE_PORT),
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: {
    rejectUnauthorized: false,
  }
  },
});
