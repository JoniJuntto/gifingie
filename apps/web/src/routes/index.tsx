import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, EyeIcon, MonitorIcon } from "lucide-react";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const me = useQuery({
		...trpc.me.get.queryOptions(),
		enabled: !!session,
	});

	useEffect(() => {
		if (!session || !me.data) return;
		navigate({
			to:
				me.data.selectedRole === "streamer"
					? "/streamer"
					: me.data.selectedRole === "viewer"
						? "/viewer"
						: "/choose-role",
			replace: true,
		});
	}, [me.data, navigate, session]);

	if (isPending || me.isLoading) {
		return (
			<div
				className="gf-page"
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontFamily: "var(--gf-font-mono)",
						fontSize: 13,
						color: "var(--gf-muted)",
						letterSpacing: "0.04em",
					}}
				>
					Loading…
				</span>
			</div>
		);
	}

	return (
		<div
			className="gf-page"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div style={{ maxWidth: 540 }}>
				<h1
					className="gf-display"
					style={{ fontSize: 64, color: "var(--gf-text)", marginBottom: 20 }}
				>
					Send a GIF.
					<br />
					<span style={{ color: "var(--gf-accent)" }}>Land it on stream.</span>
				</h1>
				<p
					style={{
						fontSize: 16,
						color: "var(--gf-muted)",
						lineHeight: 1.55,
						marginBottom: 40,
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					Sign in with Twitch to send GIFs to enrolled streamers, or enroll
					your own channel and add a browser source to OBS.
				</p>

				<div style={{ display: "flex", gap: 16 }}>
					<button
						type="button"
						className="gf-btn primary lg"
						onClick={() => navigate({ to: "/login" })}
					>
						<EyeIcon size={15} />
						Get started
						<ArrowRightIcon size={15} />
					</button>
					<button
						type="button"
						className="gf-btn outline lg"
						onClick={() => navigate({ to: "/login" })}
					>
						<MonitorIcon size={15} />
						Enroll as streamer
					</button>
				</div>
			</div>
		</div>
	);
}
