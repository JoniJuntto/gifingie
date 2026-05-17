import { useEffect, useRef, useState } from "react";
import { type ChannelInfo, ApiError, fetchChannel } from "./lib/api";
import { type TwitchBitsTransaction, type GiphyGif, getTwitchExt } from "./lib/twitch-ext";
import { SearchView } from "./components/SearchView";
import { HistoryView } from "./components/HistoryView";
import { StatusMessage } from "./components/StatusMessage";

type Tab = "search" | "history";

export function App() {
	const [token, setToken] = useState<string | null>(null);
	const [channel, setChannel] = useState<ChannelInfo | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>("search");
	const pendingSubmit = useRef<((tx: TwitchBitsTransaction) => void) | null>(null);

	useEffect(() => {
		const ext = getTwitchExt();
		if (!ext) {
			setLoadError("Twitch extension helper not loaded.");
			return;
		}

		ext.onAuthorized(async (auth) => {
			setToken(auth.token);
			ext.actions.requestIdShare();

			try {
				const info = await fetchChannel(auth.token);
				setChannel(info);
			} catch (err) {
				setLoadError(
					err instanceof ApiError ? err.message : "Failed to load channel info.",
				);
			}
		});

		ext.bits.onTransactionComplete((tx) => {
			if (pendingSubmit.current) {
				pendingSubmit.current(tx);
				pendingSubmit.current = null;
			}
		});

		ext.bits.onTransactionCancelled(() => {
			pendingSubmit.current = null;
		});
	}, []);

	function handleBitsSubmit(
		_gif: GiphyGif,
		onComplete: (tx: TwitchBitsTransaction) => void,
	) {
		const ext = getTwitchExt();
		if (!ext || !channel?.giphyPriceAmount) return;

		ext.bits.getProducts().then((products) => {
			const match = products.find(
				(p) => p.cost.amount === channel.giphyPriceAmount,
			);
			if (!match) {
				alert(
					`No bits product found for ${channel.giphyPriceAmount} bits. Contact the streamer.`,
				);
				return;
			}
			pendingSubmit.current = onComplete;
			ext.bits.useBits(match.sku);
		});
	}

	if (loadError) {
		return <StatusMessage variant="error">{loadError}</StatusMessage>;
	}

	if (!token || !channel) {
		return <StatusMessage>Loading…</StatusMessage>;
	}

	if (!channel.enrolled) {
		return (
			<StatusMessage>
				This streamer hasn't set up the gifingie extension yet.
			</StatusMessage>
		);
	}

	if (!channel.giphyEnabled) {
		return (
			<StatusMessage>GIF submissions are currently disabled.</StatusMessage>
		);
	}

	if (channel.giphyAccess !== "everyone") {
		return (
			<StatusMessage>
				GIF submissions are restricted to {channel.giphyAccess}s.
				<br />
				<br />
				Visit the streamer's gifingie page to submit.
			</StatusMessage>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					display: "flex",
					borderBottom: "1px solid var(--gf-hl)",
					flexShrink: 0,
				}}
			>
				{(["search", "history"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						style={{
							flex: 1,
							padding: "10px 0",
							background: "none",
							border: "none",
							borderBottom:
								tab === t
									? "2px solid var(--gf-accent)"
									: "2px solid transparent",
							color: tab === t ? "var(--gf-text)" : "var(--gf-muted)",
							fontWeight: tab === t ? 600 : 400,
							fontSize: 13,
							cursor: "pointer",
							fontFamily: "inherit",
							textTransform: "capitalize",
						}}
					>
						{t}
					</button>
				))}
			</div>

			<div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
				{tab === "search" && (
					<SearchView
						token={token}
						channel={channel}
						onBitsSubmit={handleBitsSubmit}
					/>
				)}
				{tab === "history" && <HistoryView token={token} />}
			</div>
		</div>
	);
}
