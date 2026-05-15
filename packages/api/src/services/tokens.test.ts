import { describe, expect, it } from "vitest";

import { createOverlayToken } from "./tokens";

describe("createOverlayToken", () => {
	it("creates unguessable 32-byte hex tokens", () => {
		const token = createOverlayToken();

		expect(token).toMatch(/^[a-f0-9]{64}$/);
	});

	it("does not reuse tokens across calls", () => {
		const tokens = new Set(
			Array.from({ length: 100 }, () => createOverlayToken()),
		);

		expect(tokens.size).toBe(100);
	});
});
