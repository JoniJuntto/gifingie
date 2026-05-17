import { useCallback, useEffect, useRef, useState } from "react";
import { type GiphyGif, type ChannelInfo, ApiError, searchGiphy, submitGif } from "../lib/api";
import type { TwitchBitsTransaction } from "../lib/twitch-ext";
import { StatusMessage } from "./StatusMessage";

type Props = {
	token: string;
	channel: ChannelInfo;
	onBitsSubmit: (gif: GiphyGif, onComplete: (tx: TwitchBitsTransaction) => void) => void;
};

export function SearchView({ token, channel, onBitsSubmit }: Props) {
	const [query, setQuery] = useState("");
	const [gifs, setGifs] = useState<GiphyGif[]>([]);
	const [loading, setLoading] = useState(false);
	const [selected, setSelected] = useState<GiphyGif | null>(null);
	const [caption, setCaption] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const doSearch = useCallback(
		async (q: string) => {
			if (!q.trim()) {
				setGifs([]);
				return;
			}
			setLoading(true);
			try {
				const result = await searchGiphy(token, q);
				setGifs(result.gifs);
			} catch {
				setGifs([]);
			} finally {
				setLoading(false);
			}
		},
		[token],
	);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => doSearch(query), 400);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query, doSearch]);

	async function handleSubmitFree() {
		if (!selected) return;
		setSubmitting(true);
		setError(null);
		try {
			await submitGif(token, {
				giphyId: selected.id,
				gifUrl: selected.gifUrl,
				previewUrl: selected.previewUrl,
				title: selected.title,
				caption: caption.trim() || undefined,
			});
			setSubmitted(true);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to submit");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleSubmitBits() {
		if (!selected) return;
		setError(null);
		const gif = selected;

		onBitsSubmit(gif, async (tx) => {
			setSubmitting(true);
			try {
				await submitGif(token, {
					giphyId: gif.id,
					gifUrl: gif.gifUrl,
					previewUrl: gif.previewUrl,
					title: gif.title,
					caption: caption.trim() || undefined,
					transactionReceipt: tx.transactionReceipt,
				});
				setSubmitted(true);
			} catch (err) {
				setError(err instanceof ApiError ? err.message : "Failed to submit");
			} finally {
				setSubmitting(false);
			}
		});
	}

	if (submitted) {
		return (
			<div style={{ padding: "32px 16px", textAlign: "center" }}>
				<div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
				<div style={{ color: "var(--gf-ok)", fontWeight: 600, marginBottom: 8 }}>
					GIF submitted!
				</div>
				<div style={{ color: "var(--gf-muted)", fontSize: 12, marginBottom: 20 }}>
					Your GIF is in the queue.
				</div>
				<button
					type="button"
					onClick={() => {
						setSubmitted(false);
						setSelected(null);
						setCaption("");
						setQuery("");
						setGifs([]);
					}}
					style={secondaryButtonStyle}
				>
					Send another
				</button>
			</div>
		);
	}

	if (selected) {
		const needsBits = channel.giphyPriceCurrency === "bits" && channel.giphyPriceAmount;
		return (
			<div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
				<button
					type="button"
					onClick={() => { setSelected(null); setError(null); }}
					style={{ background: "none", border: "none", color: "var(--gf-muted)", fontSize: 12, textAlign: "left", cursor: "pointer", padding: 0 }}
				>
					← Back
				</button>
				<img
					src={selected.previewUrl ?? selected.gifUrl}
					alt={selected.title}
					style={{ width: "100%", borderRadius: 6, maxHeight: 160, objectFit: "cover" }}
				/>
				<div style={{ fontSize: 13, color: "var(--gf-text-2)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{selected.title}
				</div>
				<input
					type="text"
					placeholder="Add a caption (optional)"
					value={caption}
					onChange={(e) => setCaption(e.target.value)}
					maxLength={120}
					style={inputStyle}
				/>
				{error && (
					<div style={{ color: "var(--gf-live)", fontSize: 12 }}>{error}</div>
				)}
				<button
					type="button"
					onClick={needsBits ? handleSubmitBits : handleSubmitFree}
					disabled={submitting}
					style={primaryButtonStyle}
				>
					{submitting
						? "Submitting…"
						: needsBits
						? `Submit for ${channel.giphyPriceAmount} bits`
						: "Submit GIF"}
				</button>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div style={{ padding: "12px 16px" }}>
				<input
					type="text"
					placeholder="Search GIPHY…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					autoFocus
					style={inputStyle}
				/>
			</div>

			{loading && (
				<StatusMessage>Searching…</StatusMessage>
			)}

			{!loading && query && gifs.length === 0 && (
				<StatusMessage>No GIFs found for "{query}"</StatusMessage>
			)}

			{!loading && !query && (
				<StatusMessage>Type to search GIPHY</StatusMessage>
			)}

			{!loading && gifs.length > 0 && (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(2, 1fr)",
						gap: 4,
						padding: "0 16px 16px",
						overflowY: "auto",
						flex: 1,
					}}
				>
					{gifs.map((gif) => (
						<button
							key={gif.id}
							type="button"
							onClick={() => setSelected(gif)}
							style={{
								background: "var(--gf-bg-2)",
								border: "1px solid var(--gf-hl)",
								borderRadius: 6,
								overflow: "hidden",
								padding: 0,
								cursor: "pointer",
								aspectRatio: "1",
							}}
						>
							<img
								src={gif.previewUrl ?? gif.gifUrl}
								alt={gif.title}
								loading="lazy"
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

const inputStyle: React.CSSProperties = {
	width: "100%",
	background: "var(--gf-bg-2)",
	border: "1px solid var(--gf-hl)",
	borderRadius: 6,
	padding: "8px 12px",
	color: "var(--gf-text)",
	fontSize: 13,
	fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
	width: "100%",
	background: "var(--gf-accent)",
	color: "var(--gf-on-accent)",
	border: "none",
	borderRadius: 6,
	padding: "10px 16px",
	fontWeight: 600,
	fontSize: 13,
	fontFamily: "inherit",
	cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
	background: "var(--gf-bg-2)",
	color: "var(--gf-text)",
	border: "1px solid var(--gf-hl)",
	borderRadius: 6,
	padding: "8px 20px",
	fontSize: 13,
	fontFamily: "inherit",
	cursor: "pointer",
};
