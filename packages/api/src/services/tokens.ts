import { randomBytes } from "node:crypto";

export function createOverlayToken() {
	return randomBytes(32).toString("hex");
}
