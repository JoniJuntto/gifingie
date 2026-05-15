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
};

const DISPLAY_MS = 10_000;
const POLL_MS = 1_500;

function RouteComponent() {
	const { overlayToken } = Route.useParams();
	const [queue, setQueue] = useState<OverlayGif[]>([]);
	const [current, setCurrent] = useState<OverlayGif | null>(null);
	const [lastSeenId, setLastSeenId] = useState<number | null>(null);
	const seenIds = useRef(new Set<number>());
	const apiBase = useMemo(() => env.VITE_SERVER_URL.replace(/\/$/, ""), []);

	useEffect(() => {
		let cancelled = false;

		async function poll() {
			const params = lastSeenId ? `?after=${lastSeenId}` : "";
			const response = await fetch(
				`${apiBase}/api/overlay/${overlayToken}/gifs${params}`,
			);
			if (!response.ok || cancelled) {
				return;
			}

			const payload = (await response.json()) as { gifs: OverlayGif[] };
			const fresh = payload.gifs.filter((gif) => !seenIds.current.has(gif.id));
			if (fresh.length === 0) {
				return;
			}

			for (const gif of fresh) {
				seenIds.current.add(gif.id);
			}
			setLastSeenId(fresh[fresh.length - 1]?.id ?? lastSeenId);
			setQueue((existing) => [...existing, ...fresh]);
		}

		poll();
		const interval = window.setInterval(poll, POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [apiBase, lastSeenId, overlayToken]);

	useEffect(() => {
		if (current || queue.length === 0) {
			return;
		}

		const [next, ...remaining] = queue;
		setCurrent(next);
		setQueue(remaining);

		fetch(`${apiBase}/api/overlay/${overlayToken}/ack`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ submissionId: next.id }),
		});

		const timeout = window.setTimeout(() => setCurrent(null), DISPLAY_MS);
		return () => window.clearTimeout(timeout);
	}, [apiBase, current, overlayToken, queue]);

	return (
		<main className="grid h-screen w-screen place-items-center overflow-hidden bg-transparent">
			{current ? (
				<img
					alt={current.title}
					className="fade-in zoom-in-95 max-h-[86vh] max-w-[86vw] animate-in object-contain duration-300"
					src={current.gifUrl}
				/>
			) : null}
		</main>
	);
}
