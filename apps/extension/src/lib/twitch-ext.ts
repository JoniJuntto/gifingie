export type TwitchExtAuth = {
	token: string;
	channelId: string;
	clientId: string;
	userId: string;
	helixToken: string;
};

export type TwitchBitsProduct = {
	sku: string;
	displayName: string;
	cost: { amount: number; type: "bits" };
	inDevelopment: boolean;
};

export type TwitchBitsTransaction = {
	transactionId: string;
	transactionReceipt: string;
	userId: string;
	displayName: string;
	product: TwitchBitsProduct;
};

type TwitchExt = {
	onAuthorized: (callback: (auth: TwitchExtAuth) => void) => void;
	actions: {
		requestIdShare: () => void;
	};
	bits: {
		getProducts: () => Promise<TwitchBitsProduct[]>;
		useBits: (sku: string) => void;
		onTransactionComplete: (
			callback: (transaction: TwitchBitsTransaction) => void,
		) => void;
		onTransactionCancelled: (callback: () => void) => void;
	};
};

declare global {
	interface Window {
		Twitch?: { ext: TwitchExt };
	}
}

export function getTwitchExt(): TwitchExt | null {
	return window.Twitch?.ext ?? null;
}
