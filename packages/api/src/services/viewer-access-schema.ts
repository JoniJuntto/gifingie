import { z } from "zod";

export const viewerAccessLevelSchema = z.enum([
	"everyone",
	"followers",
	"subscribers",
]);

export type ViewerAccessLevel = z.infer<typeof viewerAccessLevelSchema>;
