import { cors } from "@elysiajs/cors";
import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import {
	ackOverlayGif,
	getOverlayGifs,
} from "@my-better-t-app/api/services/overlay";
import { auth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia, t } from "elysia";

new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.all("/trpc/*", async (context) => {
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		return res;
	})
	.get(
		"/api/overlay/:overlayToken/gifs",
		async ({ params, query, status }) => {
			const after = query.after ? Number(query.after) : undefined;
			if (
				query.after &&
				(after === undefined || !Number.isSafeInteger(after) || after < 0)
			) {
				return status(400, { error: "Invalid after cursor" });
			}

			const payload = await getOverlayGifs(params.overlayToken, after);
			if (!payload) {
				return status(404, { error: "Overlay not found" });
			}

			return payload;
		},
		{
			params: t.Object({
				overlayToken: t.String({ minLength: 32 }),
			}),
			query: t.Object({
				after: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/api/overlay/:overlayToken/ack",
		async ({ body, params, status }) => {
			const submission = await ackOverlayGif(
				params.overlayToken,
				body.submissionId,
			);
			if (!submission) {
				return status(404, { error: "Submission not found" });
			}

			return { ok: true };
		},
		{
			params: t.Object({
				overlayToken: t.String({ minLength: 32 }),
			}),
			body: t.Object({
				submissionId: t.Number({ minimum: 1 }),
			}),
		},
	)
	.get("/", () => "OK")
	.listen(env.PORT, () => {
		console.log(`Server is running on http://localhost:${env.PORT}`);
	});
