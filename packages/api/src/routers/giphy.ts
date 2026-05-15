import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { searchGiphy } from "../services/giphy";

export const giphyRouter = router({
	search: protectedProcedure
		.input(z.object({ query: z.string().trim().min(2).max(80) }))
		.query(({ input }) => searchGiphy(input.query)),
});
