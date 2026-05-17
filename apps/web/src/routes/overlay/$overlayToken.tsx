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
	settings?: {
		gifDisplaySeconds?: number;
		overlayGifXPercent?: number;
		overlayGifYPercent?: number;
		overlayGifWidthPercent?: number;
		overlayGifHeightPercent?: number;
	};
};

type CurrentOverlayGif = OverlayGif & { displaySeconds: number };
type OverlayLayout = {
	overlayGifXPercent: number;
	overlayGifYPercent: number;
	overlayGifWidthPercent: number;
	overlayGifHeightPercent: number;
};

const DEFAULT_DISPLAY_SECONDS = 10;
const MIN_DISPLAY_SECONDS = 1;
const MAX_DISPLAY_SECONDS = 60;
const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
	overlayGifXPercent: 50,
	overlayGifYPercent: 78,
	overlayGifWidthPercent: 28,
	overlayGifHeightPercent: 22,
};
const POLL_MS = 1_500;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clampOverlayLayout(layout: OverlayLayout): OverlayLayout {
	const width = clamp(Math.round(layout.overlayGifWidthPercent), 5, 100);
	const height = clamp(Math.round(layout.overlayGifHeightPercent), 5, 100);
	const halfWidth = width / 2;
	const halfHeight = height / 2;

	return {
		overlayGifWidthPercent: width,
		overlayGifHeightPercent: height,
		overlayGifXPercent: clamp(
			Math.round(layout.overlayGifXPercent),
			halfWidth,
			100 - halfWidth,
		),
		overlayGifYPercent: clamp(
			Math.round(layout.overlayGifYPercent),
			halfHeight,
			100 - halfHeight,
		),
	};
}

function RouteComponent() {
	const { overlayToken } = Route.useParams();
	const [queue, setQueue] = useState<OverlayGif[]>([]);
	const [current, setCurrent] = useState<CurrentOverlayGif | null>(null);
	const [displaySeconds, setDisplaySeconds] = useState(DEFAULT_DISPLAY_SECONDS);
	const [layout, setLayout] = useState<OverlayLayout>(DEFAULT_OVERLAY_LAYOUT);
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
			const maybeLayout = Array.isArray(payload) ? undefined : payload.settings;

			if (
				typeof maybeDs === "number" &&
				Number.isInteger(maybeDs) &&
				maybeDs >= MIN_DISPLAY_SECONDS &&
				maybeDs <= MAX_DISPLAY_SECONDS
			) {
				setDisplaySeconds(maybeDs);
			}

			if (
				typeof maybeLayout?.overlayGifXPercent === "number" &&
				typeof maybeLayout.overlayGifYPercent === "number" &&
				typeof maybeLayout.overlayGifWidthPercent === "number" &&
				typeof maybeLayout.overlayGifHeightPercent === "number"
			) {
				setLayout(
					clampOverlayLayout({
						overlayGifXPercent: maybeLayout.overlayGifXPercent,
						overlayGifYPercent: maybeLayout.overlayGifYPercent,
						overlayGifWidthPercent: maybeLayout.overlayGifWidthPercent,
						overlayGifHeightPercent: maybeLayout.overlayGifHeightPercent,
					}),
				);
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
	const safeLayout = clampOverlayLayout(layout);

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
			<div
				style={{
					position: "absolute",
					left: `${safeLayout.overlayGifXPercent}%`,
					top: `${safeLayout.overlayGifYPercent}%`,
					width: `${safeLayout.overlayGifWidthPercent}%`,
					height: `${safeLayout.overlayGifHeightPercent}%`,
					transform: "translate(-50%, -50%)",
					minWidth: 96,
					minHeight: 72,
					display: "flex",
					flexDirection: "column",
					background: "rgba(0,0,0,0.72)",
					border: "1px solid rgba(255,255,255,0.16)",
					boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
				}}
			>
				<img
					src={current.gifUrl}
					alt={current.title}
					style={{
						flex: 1,
						minHeight: 0,
						width: "100%",
						objectFit: "contain",
						background: "rgba(0,0,0,0.18)",
					}}
				/>
				<div
					style={{
						padding: "10px 12px 11px",
						background:
							"linear-gradient(180deg, rgba(0,0,0,0.54), rgba(0,0,0,0.82))",
					}}
				>
					<div
						style={{
							height: 3,
							width: "100%",
							background: "rgba(255,255,255,0.16)",
							marginBottom: 8,
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
							fontSize: 18,
							fontWeight: 400,
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
								fontSize: 13,
								lineHeight: 1.35,
								color: "rgba(255,255,255,0.82)",
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
