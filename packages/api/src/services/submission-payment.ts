import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import {
	paymentCredits,
	type streamerProfiles,
} from "@my-better-t-app/db/schema/domain";
import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";

import { PAYMENT_CREDIT_TTL_SECONDS } from "./constants";
import {
	getSubmissionPrice,
	type SubmissionPriceAction,
} from "./pricing-schema";
import { fulfillChannelPointsRedemption } from "./twitch";

type StreamerProfileForPayment = Pick<
	typeof streamerProfiles.$inferSelect,
	| "id"
	| "userId"
	| "twitchChannelId"
	| "giphyPriceCurrency"
	| "giphyPriceAmount"
	| "uploadPriceCurrency"
	| "uploadPriceAmount"
	| "soundPriceCurrency"
	| "soundPriceAmount"
>;

export async function getTwitchAccountForUser(userId: string) {
	const [twitchAccount] = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "twitch")))
		.limit(1);

	return twitchAccount ?? null;
}

export function paymentCreditExpiresAt() {
	return new Date(Date.now() + PAYMENT_CREDIT_TTL_SECONDS * 1000);
}

export async function insertPaymentCredit(input: {
	streamerProfileId: string;
	viewerTwitchId: string;
	viewerUserId?: string | null;
	kind: "channel_points" | "bits";
	amount: number;
	externalId: string;
	channelPointsRewardId?: string | null;
}) {
	const [credit] = await db
		.insert(paymentCredits)
		.values({
			streamerProfileId: input.streamerProfileId,
			viewerTwitchId: input.viewerTwitchId,
			viewerUserId: input.viewerUserId ?? null,
			kind: input.kind,
			amount: input.amount,
			externalId: input.externalId,
			channelPointsRewardId: input.channelPointsRewardId ?? null,
			status: "available",
			expiresAt: paymentCreditExpiresAt(),
		})
		.onConflictDoNothing({ target: paymentCredits.externalId })
		.returning();

	return credit ?? null;
}

export async function listAvailablePaymentCredits(input: {
	streamerProfileId: string;
	viewerUserId: string;
}) {
	const viewerAccount = await getTwitchAccountForUser(input.viewerUserId);
	if (!viewerAccount?.accountId) {
		return [];
	}

	const now = new Date();
	return db
		.select({
			id: paymentCredits.id,
			kind: paymentCredits.kind,
			amount: paymentCredits.amount,
			expiresAt: paymentCredits.expiresAt,
			createdAt: paymentCredits.createdAt,
		})
		.from(paymentCredits)
		.where(
			and(
				eq(paymentCredits.streamerProfileId, input.streamerProfileId),
				eq(paymentCredits.viewerTwitchId, viewerAccount.accountId),
				eq(paymentCredits.status, "available"),
				gt(paymentCredits.expiresAt, now),
			),
		);
}

function creditKindForCurrency(currency: "channel_points" | "bits") {
	return currency;
}

export async function assertSubmissionPayment(input: {
	profile: StreamerProfileForPayment;
	action: SubmissionPriceAction;
	viewerUserId: string;
	paymentCreditId?: string;
}) {
	const price = getSubmissionPrice(input.profile, input.action);
	if (!price) {
		return null;
	}

	if (!input.paymentCreditId) {
		const label =
			price.currency === "channel_points"
				? `${price.amount} channel points`
				: `${price.amount} bits`;
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Payment required: redeem or cheer ${label} on Twitch first.`,
		});
	}

	const viewerAccount = await getTwitchAccountForUser(input.viewerUserId);
	if (!viewerAccount?.accountId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Sign in with Twitch to pay for submissions.",
		});
	}

	const now = new Date();
	const [credit] = await db
		.select()
		.from(paymentCredits)
		.where(
			and(
				eq(paymentCredits.id, input.paymentCreditId),
				eq(paymentCredits.streamerProfileId, input.profile.id),
				eq(paymentCredits.viewerTwitchId, viewerAccount.accountId),
				eq(paymentCredits.status, "available"),
				gt(paymentCredits.expiresAt, now),
			),
		)
		.limit(1);

	if (!credit) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Payment credit not found or already used.",
		});
	}

	const expectedKind = creditKindForCurrency(price.currency);
	if (credit.kind !== expectedKind) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Payment credit type does not match the required price.",
		});
	}

	if (credit.amount < price.amount) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Payment credit is insufficient (need ${price.amount}, have ${credit.amount}).`,
		});
	}

	return credit;
}

export async function consumePaymentCredit(input: {
	creditId: string;
	submissionId: number;
	streamerUserId: string;
	broadcasterId: string;
}) {
	const [credit] = await db
		.select()
		.from(paymentCredits)
		.where(
			and(
				eq(paymentCredits.id, input.creditId),
				eq(paymentCredits.status, "available"),
			),
		)
		.limit(1);

	if (!credit) {
		return;
	}

	await db
		.update(paymentCredits)
		.set({
			status: "consumed",
			consumedSubmissionId: input.submissionId,
		})
		.where(eq(paymentCredits.id, credit.id));

	if (credit.kind === "channel_points" && credit.channelPointsRewardId) {
		const streamerAccount = await getTwitchAccountForUser(input.streamerUserId);
		if (streamerAccount?.accessToken) {
			try {
				await fulfillChannelPointsRedemption({
					broadcasterId: input.broadcasterId,
					accessToken: streamerAccount.accessToken,
					rewardId: credit.channelPointsRewardId,
					redemptionId: credit.externalId,
				});
			} catch {
				// Credit is consumed locally; fulfillment can be retried manually on Twitch.
			}
		}
	}
}
