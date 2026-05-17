const EBS_BASE = import.meta.env.VITE_EBS_URL ?? "http://localhost:3000";

async function request<T>(
	token: string,
	path: string,
	options?: RequestInit,
): Promise<T> {
	const res = await fetch(`${EBS_BASE}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			...(options?.headers ?? {}),
		},
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new ApiError(res.status, body.error ?? res.statusText);
	}
	return res.json() as Promise<T>;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export type ChannelInfo = {
	enrolled: boolean;
	displayName: string | null;
	avatarUrl: string | null;
	giphyEnabled: boolean;
	giphyAccess: "everyone" | "followers" | "subscribers";
	giphyPriceCurrency: "none" | "bits";
	giphyPriceAmount: number | null;
};

export type GiphyGif = {
	id: string;
	title: string;
	gifUrl: string;
	previewUrl?: string;
};

export type Submission = {
	id: number;
	gifUrl: string | null;
	previewUrl: string | null;
	title: string;
	moderationStatus: "pending" | "approved" | "rejected";
	createdAt: string;
};

export function fetchChannel(token: string): Promise<ChannelInfo> {
	return request(token, "/api/extension/channel");
}

export function searchGiphy(
	token: string,
	q: string,
): Promise<{ gifs: GiphyGif[] }> {
	return request(
		token,
		`/api/extension/giphy/search?q=${encodeURIComponent(q)}`,
	);
}

export function submitGif(
	token: string,
	body: {
		giphyId: string;
		gifUrl: string;
		previewUrl?: string;
		title: string;
		caption?: string;
		transactionReceipt?: string;
	},
): Promise<{ submissionId: number }> {
	return request(token, "/api/extension/submit", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function fetchSubmissions(
	token: string,
): Promise<{ submissions: Submission[] }> {
	return request(token, "/api/extension/submissions");
}
