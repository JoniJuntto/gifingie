import { publicProcedure, router } from "../index";
import { gifsRouter } from "./gifs";
import { giphyRouter } from "./giphy";
import { meRouter } from "./me";
import { streamerRouter } from "./streamer";
import { streamersRouter } from "./streamers";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	me: meRouter,
	streamer: streamerRouter,
	streamers: streamersRouter,
	giphy: giphyRouter,
	gifs: gifsRouter,
});
export type AppRouter = typeof appRouter;
