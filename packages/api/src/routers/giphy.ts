import { z } from "zod";

import { router, sessionProcedure } from "../index";
import { searchGiphy } from "../services/giphy";

export const giphyRouter = router({
	search: sessionProcedure
		.input(z.object({ query: z.string().trim().min(2).max(80) }))
		.query(({ input }) => searchGiphy(input.query)),
});
