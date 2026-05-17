import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const sessionProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

export const protectedProcedure = sessionProcedure.use(({ ctx, next }) => {
	if (ctx.session.user.isAnonymous) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Twitch sign-in required",
			cause: "Anonymous session",
		});
	}

	return next({
		ctx,
	});
});
