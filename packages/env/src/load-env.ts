import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function findRepoRoot(from: string): string {
	let dir = from;
	while (true) {
		if (existsSync(path.join(dir, "turbo.json"))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return from;
		}
		dir = parent;
	}
}

export function loadMonorepoEnv(): void {
	const root = findRepoRoot(path.resolve(thisDir, "../.."));
	const envPaths = [
		{ path: path.join(root, ".env"), override: false },
		{ path: path.join(root, "packages/env/.env"), override: true },
		{ path: path.join(root, "apps/server/.env"), override: false },
	];

	for (const { path: envPath, override } of envPaths) {
		if (existsSync(envPath)) {
			config({ path: envPath, override });
		}
	}
}

loadMonorepoEnv();
