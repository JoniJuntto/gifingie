import { cors } from "@elysiajs/cors";
import { createContext } from "@my-better-t-app/api/context";
import { extensionRouter } from "@my-better-t-app/api/routers/extension";
import { appRouter } from "@my-better-t-app/api/routers/index";
import {
	ackOverlayGif,
	getOverlayGifs,
} from "@my-better-t-app/api/services/overlay";
import {
	handleEventSubNotification,
	verifyEventSubSignature,
} from "@my-better-t-app/api/services/twitch-eventsub";
import { auth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia, t } from "elysia";

new Elysia()
	.use(extensionRouter)
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
	.post("/api/twitch/eventsub", async ({ request, status }) => {
		const body = await request.text();
		const messageId = request.headers.get("twitch-eventsub-message-id");
		const timestamp = request.headers.get("twitch-eventsub-message-timestamp");
		const signature = request.headers.get("twitch-eventsub-message-signature");
		const messageType = request.headers.get("twitch-eventsub-message-type");

		if (!messageId || !timestamp || !signature || !messageType) {
			return status(400, { error: "Missing EventSub headers." });
		}

		try {
			verifyEventSubSignature({
				messageId,
				timestamp,
				body,
				signature,
			});
		} catch {
			return status(403, { error: "Invalid signature." });
		}

		const payload = JSON.parse(body) as {
			challenge?: string;
			subscription: { type: string };
			event: Record<string, unknown>;
		};

		if (messageType === "webhook_callback_verification") {
			return new Response(payload.challenge ?? "", {
				headers: { "Content-Type": "text/plain" },
			});
		}

		if (messageType === "notification") {
			await handleEventSubNotification(payload);
		}

		return { ok: true };
	})
	.get("/", () => "OK")
	.listen(env.PORT, () => {
		console.log(`Server is running on http://localhost:${env.PORT}`);
	});
