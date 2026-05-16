import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { EyeIcon, MonitorIcon } from "lucide-react";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/choose-role")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const me = useQuery(trpc.me.get.queryOptions());
	const setRole = useMutation(
		trpc.me.setRole.mutationOptions({
			onSuccess: async (_, variables) => {
				await queryClient.invalidateQueries();
				navigate({
					to: variables.role === "streamer" ? "/streamer" : "/viewer",
					replace: true,
				});
			},
		}),
	);

	// If sign-in page pre-selected a role, auto-apply it
	useEffect(() => {
		const preferred = sessionStorage.getItem("gf-preferred-role") as
			| "viewer"
			| "streamer"
			| null;
		if (preferred === "viewer" || preferred === "streamer") {
			sessionStorage.removeItem("gf-preferred-role");
			setRole.mutate({ role: preferred });
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	if (setRole.isPending || me.isLoading) {
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
					Setting up…
				</span>
			</div>
		);
	}

	const ROLES = [
		{
			role: "viewer" as const,
			title: "Viewer",
			sub: "Browse live enrolled streamers and send GIPHY GIFs into their overlay queue.",
			Icon: EyeIcon,
		},
		{
			role: "streamer" as const,
			title: "Streamer",
			sub: "Enroll your Twitch channel and copy a private browser-source URL for OBS.",
			Icon: MonitorIcon,
		},
	];

	return (
		<div
			className="gf-page"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div style={{ width: 480 }}>
				<div className="gf-eyebrow" style={{ marginBottom: 16 }}>
					Welcome to gifingie
				</div>
				<h1
					className="gf-display"
					style={{ fontSize: 48, fontWeight: 300, marginBottom: 8 }}
				>
					How will you use it?
				</h1>
				<p
					style={{
						fontSize: 14,
						color: "var(--gf-muted)",
						marginBottom: 36,
						lineHeight: 1.55,
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					Choose your default landing page. You can switch anytime in Settings.
				</p>

				<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
					{ROLES.map(({ role, title, sub, Icon }) => (
						<button
							key={role}
							type="button"
							disabled={setRole.isPending}
							onClick={() => setRole.mutate({ role })}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 18,
								width: "100%",
								padding: "24px 0",
								background: "transparent",
								border: "none",
								borderBottom: "1px solid var(--gf-hl)",
								cursor: "pointer",
								textAlign: "left",
							}}
						>
							<Icon size={20} color="var(--gf-muted)" />
							<div style={{ flex: 1 }}>
								<div
									style={{
										fontSize: 17,
										fontWeight: 500,
										color: "var(--gf-text)",
										letterSpacing: "-0.02em",
										fontFamily: "var(--gf-font-ui)",
									}}
								>
									{title}
								</div>
								<div
									style={{
										fontSize: 13,
										color: "var(--gf-muted)",
										marginTop: 3,
										lineHeight: 1.5,
										fontFamily: "var(--gf-font-ui)",
									}}
								>
									{sub}
								</div>
							</div>
							<span
								style={{
									fontSize: 18,
									color: "var(--gf-muted-2)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								→
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
