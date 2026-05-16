import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { SearchScreen } from "@/routes/viewer";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/s/$login")({
	component: RouteComponent,
});

function ShareState({
	title,
	subtitle,
	login,
}: {
	title: string;
	subtitle: string;
	login: string;
}) {
	return (
		<div
			className="gf-page"
			style={{
				minHeight: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40,
			}}
		>
			<div style={{ maxWidth: 520, width: "100%" }}>
				<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
					Streamer link
				</div>
				<h1
					className="gf-display"
					style={{
						fontSize: 48,
						fontWeight: 300,
						color: "var(--gf-text)",
						marginBottom: 16,
					}}
				>
					{title}
				</h1>
				<p
					style={{
						margin: 0,
						fontSize: 15,
						lineHeight: 1.55,
						color: "var(--gf-muted)",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					{subtitle}
				</p>
				<div
					style={{
						marginTop: 24,
						display: "flex",
						alignItems: "center",
						gap: 12,
					}}
				>
					<div
						className="gf-code"
						style={{ flex: 1, minWidth: 0, overflow: "hidden" }}
					>
						@{login}
					</div>
					<Link to="/viewer" className="gf-btn primary">
						Browse live
					</Link>
				</div>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { login } = Route.useParams();
	const recordedVisitId = useRef<string | null>(null);
	const streamer = useQuery(trpc.streamers.getByLogin.queryOptions({ login }));
	const recordVisit = useMutation(
		trpc.streamers.recordShareVisit.mutationOptions(),
	);

	useEffect(() => {
		const streamerId = streamer.data?.id;
		if (!streamerId || recordedVisitId.current === streamerId) return;
		recordedVisitId.current = streamerId;
		recordVisit.mutate({ streamerProfileId: streamerId });
	}, [recordVisit, streamer.data?.id]);

	if (streamer.isLoading) {
		return (
			<ShareState
				login={login}
				title="Loading channel."
				subtitle="Checking whether this streamer is enrolled and live right now."
			/>
		);
	}

	if (!streamer.data) {
		return (
			<ShareState
				login={login}
				title="Streamer not found."
				subtitle="This channel is not enrolled for GIF submissions yet."
			/>
		);
	}

	if (!streamer.data.isLive) {
		return (
			<ShareState
				login={streamer.data.twitchChannelLogin}
				title={`${streamer.data.twitchDisplayName} is offline.`}
				subtitle="GIF submissions open when the streamer is live."
			/>
		);
	}

	return (
		<SearchScreen
			streamer={streamer.data}
			onBack={() => {
				window.location.href = "/viewer";
			}}
		/>
	);
}
