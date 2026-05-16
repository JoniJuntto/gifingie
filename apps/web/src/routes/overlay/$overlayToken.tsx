import { env } from "@my-better-t-app/env/web";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/overlay/$overlayToken")({
	component: RouteComponent,
});

type OverlayGif = {
	id: number;
	gifUrl: string;
	title: string;
	caption?: string | null;
};

type OverlayPayload = {
	gifs?: OverlayGif[];
	settings?: { gifDisplaySeconds?: number };
};

type CurrentOverlayGif = OverlayGif & { displaySeconds: number };

const DEFAULT_DISPLAY_SECONDS = 10;
const MIN_DISPLAY_SECONDS = 1;
const MAX_DISPLAY_SECONDS = 60;
const POLL_MS = 1_500;

function RouteComponent() {
	const { overlayToken } = Route.useParams();
	const [queue, setQueue] = useState<OverlayGif[]>([]);
	const [current, setCurrent] = useState<CurrentOverlayGif | null>(null);
	const [displaySeconds, setDisplaySeconds] = useState(DEFAULT_DISPLAY_SECONDS);
	const [elapsed, setElapsed] = useState(0);
	const lastSeenId = useRef<number | null>(null);
	const seenIds = useRef(new Set<number>());
	const apiBase = useMemo(() => env.VITE_SERVER_URL.replace(/\/$/, ""), []);

	// Poll for new gifs
	useEffect(() => {
		let cancelled = false;

		async function poll() {
			const params = lastSeenId.current ? `?after=${lastSeenId.current}` : "";
			const response = await fetch(
				`${apiBase}/api/overlay/${overlayToken}/gifs${params}`,
			);
			if (!response.ok || cancelled) return;

			const payload = (await response.json()) as OverlayPayload | OverlayGif[];
			const gifs = Array.isArray(payload) ? payload : (payload.gifs ?? []);
			const maybeDs = Array.isArray(payload)
				? undefined
				: payload.settings?.gifDisplaySeconds;

			if (
				typeof maybeDs === "number" &&
				Number.isInteger(maybeDs) &&
				maybeDs >= MIN_DISPLAY_SECONDS &&
				maybeDs <= MAX_DISPLAY_SECONDS
			) {
				setDisplaySeconds(maybeDs);
			}

			const fresh = gifs.filter((g) => !seenIds.current.has(g.id));
			if (!fresh.length) return;

			for (const g of fresh) seenIds.current.add(g.id);
			lastSeenId.current = fresh[fresh.length - 1]?.id ?? lastSeenId.current;
			setQueue((q) => [...q, ...fresh]);
		}

		poll();
		const iv = window.setInterval(poll, POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(iv);
		};
	}, [apiBase, overlayToken]);

	// Advance queue
	useEffect(() => {
		if (current || queue.length === 0) return;
		const [next, ...rest] = queue;
		setCurrent({ ...next, displaySeconds });
		setQueue(rest);
		setElapsed(0);
	}, [current, displaySeconds, queue]);

	// Elapsed progress & ack
	useEffect(() => {
		if (!current) return;

		fetch(`${apiBase}/api/overlay/${overlayToken}/ack`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ submissionId: current.id }),
		});

		const startMs = Date.now();
		const tickMs = 100;
		const iv = window.setInterval(() => {
			const e = (Date.now() - startMs) / 1000;
			setElapsed(e);
			if (e >= current.displaySeconds) {
				window.clearInterval(iv);
				setCurrent(null);
			}
		}, tickMs);

		return () => window.clearInterval(iv);
	}, [apiBase, current, overlayToken]);

	const progress = current ? Math.min(1, elapsed / current.displaySeconds) : 0;

	// Show nothing when idle
	if (!current) {
		return (
			<div
				style={{
					position: "fixed",
					inset: 0,
					background: "transparent",
				}}
			/>
		);
	}

	const upNext = queue.slice(0, 3);

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: "transparent",
				pointerEvents: "none",
				fontFamily:
					"'Geist', -apple-system, 'SF Pro Display', system-ui, sans-serif",
				WebkitFontSmoothing: "antialiased",
			}}
		>
			{/* Bottom overlay strip */}
			<div
				style={{
					position: "absolute",
					left: 32,
					right: 32,
					bottom: 28,
				}}
			>
				{/* Progress bar */}
				<div
					style={{
						height: 2,
						width: "100%",
						background: "rgba(255,255,255,0.12)",
						marginBottom: 14,
					}}
				>
					<div
						style={{
							height: "100%",
							width: `${(1 - progress) * 100}%`,
							background: "#ff6b35",
							transition: "width 0.1s linear",
						}}
					/>
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 20,
					}}
				>
					{/* Current GIF thumbnail */}
					<img
						src={current.gifUrl}
						alt={current.title}
						style={{
							width: 90,
							height: 64,
							objectFit: "cover",
							borderRadius: 4,
							flexShrink: 0,
						}}
					/>

					{/* Now playing info */}
					<div style={{ flex: "0 1 auto", minWidth: 0 }}>
						<div
							style={{
								fontSize: 10,
								letterSpacing: "0.18em",
								textTransform: "uppercase",
								color: "#ff6b35",
								marginBottom: 4,
								fontWeight: 600,
							}}
						>
							Now playing
						</div>
						<div
							style={{
								fontSize: 20,
								fontWeight: 300,
								letterSpacing: "-0.03em",
								color: "#ffffff",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{current.title}
						</div>
						{current.caption && (
							<div
								style={{
									marginTop: 4,
									fontSize: 14,
									lineHeight: 1.35,
									color: "rgba(255,255,255,0.82)",
									maxWidth: 680,
									overflow: "hidden",
									display: "-webkit-box",
									WebkitLineClamp: 2,
									WebkitBoxOrient: "vertical",
								}}
							>
								{current.caption}
							</div>
						)}
					</div>

					{/* Up next */}
					{upNext.length > 0 && (
						<div
							style={{
								marginLeft: "auto",
								display: "flex",
								alignItems: "center",
								gap: 16,
							}}
						>
							<div
								style={{
									fontSize: 10,
									letterSpacing: "0.18em",
									textTransform: "uppercase",
									color: "rgba(255,255,255,0.45)",
									fontWeight: 600,
								}}
							>
								Up next
							</div>
							{upNext.map((g) => (
								<div
									key={g.id}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										opacity: 0.85,
									}}
								>
									<img
										src={g.gifUrl}
										alt={g.title}
										style={{
											width: 48,
											height: 32,
											objectFit: "cover",
											borderRadius: 3,
											flexShrink: 0,
										}}
									/>
									<div
										style={{
											fontSize: 11,
											color: "rgba(255,255,255,0.70)",
											maxWidth: 100,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{g.title}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Brand pinpoint */}
			<div
				style={{
					position: "absolute",
					bottom: 10,
					left: 32,
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					color: "rgba(255,255,255,0.35)",
					fontFamily: "'JetBrains Mono', ui-monospace, monospace",
					fontSize: 9,
					letterSpacing: "0.06em",
				}}
			>
				gifingie
			</div>
		</div>
	);
}
