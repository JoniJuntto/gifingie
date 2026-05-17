import { env } from "@my-better-t-app/env/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

const TWITCH_BITS_JWKS_URL =
	"https://api.twitch.tv/v5/bits/extensions/twitch-purchases.jwt.json";

let bitsJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getBitsJwks() {
	if (!bitsJwks) {
		bitsJwks = createRemoteJWKSet(new URL(TWITCH_BITS_JWKS_URL));
	}
	return bitsJwks;
}

function getExtensionSecret() {
	return Buffer.from(env.TWITCH_EXTENSION_SECRET, "base64");
}

export type ExtensionJWTPayload = {
	channelId: string;
	opaqueUserId: string;
	userId: string | null;
	role: "viewer" | "broadcaster" | "moderator" | "external";
};

export async function verifyExtensionJWT(
	token: string,
): Promise<ExtensionJWTPayload> {
	const secret = getExtensionSecret();
	const { payload } = await jwtVerify(token, secret, {
		algorithms: ["HS256"],
	});

	const channelId = payload.channel_id as string | undefined;
	const opaqueUserId = payload.opaque_user_id as string | undefined;
	const userId = (payload.user_id as string | undefined) ?? null;
	const role = payload.role as string | undefined;

	if (!channelId || !opaqueUserId) {
		throw new Error("Invalid extension JWT: missing channel_id or opaque_user_id");
	}

	return {
		channelId,
		opaqueUserId,
		userId: userId || null,
		role: (role as ExtensionJWTPayload["role"]) ?? "viewer",
	};
}

export type BitsReceiptPayload = {
	transactionId: string;
	userId: string;
	product: {
		sku: string;
		cost: { amount: number; type: string };
		domainId: string;
	};
};

export async function verifyBitsReceipt(
	receipt: string,
): Promise<BitsReceiptPayload> {
	const jwks = getBitsJwks();
	const { payload } = await jwtVerify(receipt, jwks, {
		algorithms: ["RS256"],
	});

	const data = payload.data as Record<string, unknown> | undefined;
	if (!data) {
		throw new Error("Invalid bits receipt: missing data");
	}

	const transactionId = data.transactionId as string | undefined;
	const userId = data.userId as string | undefined;
	const product = data.product as
		| { sku: string; cost: { amount: number; type: string }; domainId: string }
		| undefined;

	if (!transactionId || !userId || !product?.sku) {
		throw new Error("Invalid bits receipt: missing required fields");
	}

	const expectedDomain = `twitch.ext.${env.TWITCH_EXTENSION_CLIENT_ID}`;
	if (product.domainId !== expectedDomain) {
		throw new Error("Invalid bits receipt: domain mismatch");
	}

	return { transactionId, userId, product };
}
