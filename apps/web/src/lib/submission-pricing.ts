export type PriceCurrency = "none" | "channel_points" | "bits";

export type PublicPrice = {
	currency: Exclude<PriceCurrency, "none">;
	amount: number;
};

export function formatPrice(price: PublicPrice | null | undefined) {
	if (!price) return "Free";
	if (price.currency === "channel_points") {
		return `${price.amount.toLocaleString()} channel points`;
	}
	return `${price.amount.toLocaleString()} bits`;
}

export function paymentInstructions(price: PublicPrice | null | undefined) {
	if (!price) return null;
	if (price.currency === "channel_points") {
		return `Redeem the channel point reward on Twitch (${formatPrice(price)}), then return here to send.`;
	}
	return `Cheer at least ${formatPrice(price)} in chat, then return here to send.`;
}
