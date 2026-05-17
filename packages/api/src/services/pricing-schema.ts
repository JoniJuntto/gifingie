import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const priceCurrencySchema = z.enum([
	"none",
	"channel_points",
	"bits",
]);

export type PriceCurrency = z.infer<typeof priceCurrencySchema>;

export const pricingInputSchema = z.object({
	giphyPriceCurrency: priceCurrencySchema,
	giphyPriceAmount: z.number().int().positive().nullable(),
	uploadPriceCurrency: priceCurrencySchema,
	uploadPriceAmount: z.number().int().positive().nullable(),
	soundPriceCurrency: priceCurrencySchema,
	soundPriceAmount: z.number().int().positive().nullable(),
});

export type SubmissionPriceAction = "giphy" | "upload" | "sound";

export function normalizePriceAmount(
	currency: PriceCurrency,
	amount: number | null | undefined,
) {
	if (currency === "none") return null;
	if (!amount || amount < 1) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Price amount must be at least 1.",
		});
	}
	return amount;
}

export function getSubmissionPrice(
	profile: {
		giphyPriceCurrency: PriceCurrency;
		giphyPriceAmount: number | null;
		uploadPriceCurrency: PriceCurrency;
		uploadPriceAmount: number | null;
		soundPriceCurrency: PriceCurrency;
		soundPriceAmount: number | null;
	},
	action: SubmissionPriceAction,
) {
	const currency =
		action === "giphy"
			? profile.giphyPriceCurrency
			: action === "upload"
				? profile.uploadPriceCurrency
				: profile.soundPriceCurrency;
	const amount =
		action === "giphy"
			? profile.giphyPriceAmount
			: action === "upload"
				? profile.uploadPriceAmount
				: profile.soundPriceAmount;

	if (currency === "none" || !amount || amount < 1) {
		return null;
	}

	return { currency, amount } as const;
}

export function toPublicPrice(
	currency: PriceCurrency,
	amount: number | null,
) {
	if (currency === "none" || !amount || amount < 1) return null;
	return { currency, amount };
}
