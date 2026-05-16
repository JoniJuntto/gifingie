import { createFileRoute } from "@tanstack/react-router";
import { EyeIcon, MonitorIcon, ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { appUrl, authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

type Role = "viewer" | "streamer";

function RoleRow({
	icon,
	title,
	sub,
	selected,
	onClick,
}: {
	icon: "eye" | "monitor";
	title: string;
	sub: string;
	selected: boolean;
	onClick: () => void;
}) {
	const Icon = icon === "eye" ? EyeIcon : MonitorIcon;
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
			style={{
				display: "flex",
				alignItems: "center",
				gap: 16,
				padding: "18px 0",
				borderBottom: "1px solid var(--gf-hl)",
				cursor: "pointer",
			}}
		>
			<Icon
				size={20}
				color={selected ? "var(--gf-text)" : "var(--gf-muted)"}
			/>
			<div style={{ flex: 1 }}>
				<div
					style={{
						fontSize: 16,
						fontWeight: 500,
						letterSpacing: "-0.02em",
						color: "var(--gf-text)",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					{title}
				</div>
				<div
					style={{
						fontSize: 13,
						color: "var(--gf-muted)",
						marginTop: 2,
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					{sub}
				</div>
			</div>
			<span
				style={{
					width: 18,
					height: 18,
					borderRadius: "50%",
					border: selected
						? "5px solid var(--gf-accent)"
						: "1.5px solid var(--gf-hl2)",
					transition: "border 0.12s",
					flexShrink: 0,
				}}
			/>
		</div>
	);
}

function RouteComponent() {
	const [role, setRole] = useState<Role>("viewer");

	const handleContinue = () => {
		sessionStorage.setItem("gf-preferred-role", role);
		authClient.signIn.social({
			provider: "twitch",
			callbackURL: appUrl("/choose-role"),
		});
	};

	return (
		<main
			className="gf-page"
			style={{
				display: "grid",
				gridTemplateColumns: "1.1fr 1fr",
				height: "100%",
			}}
		>
			{/* LEFT — brand wall */}
			<div
				style={{
					background: "var(--gf-inv)",
					color: "var(--gf-on-inv)",
					padding: "40px 52px",
					display: "flex",
					flexDirection: "column",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* Headline */}
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						maxWidth: 520,
					}}
				>
					<h1
						className="gf-display"
						style={{
							fontSize: 72,
							color: "var(--gf-on-inv)",
							marginBottom: 24,
						}}
					>
						Send a GIF.
						<br />
						<span style={{ color: "var(--gf-accent)" }}>Land it on stream.</span>
					</h1>
					<p
						style={{
							fontSize: 17,
							lineHeight: 1.45,
							color: "rgba(255,255,255,0.7)",
							maxWidth: 440,
							fontWeight: 400,
							letterSpacing: "-0.015em",
							margin: 0,
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						Connect your channel to receive GIF submissions through an OBS
						browser source. Or sign in to send GIFs to streamers you love.
					</p>
				</div>

				{/* Footer meta */}
				<div
					style={{
						display: "flex",
						gap: 36,
						fontFamily: "var(--gf-font-mono)",
						fontSize: 11,
						color: "rgba(255,255,255,0.35)",
						letterSpacing: "0.04em",
					}}
				>
					<span>v 0.1.0</span>
					<span style={{ marginLeft: "auto" }}>
						status · all systems normal
					</span>
				</div>
			</div>

			{/* RIGHT — sign-in column */}
			<div
				style={{
					padding: "40px 56px",
					display: "flex",
					flexDirection: "column",
					background: "var(--gf-bg)",
				}}
			>
				<div
					style={{
						marginLeft: "auto",
						fontSize: 13,
						color: "var(--gf-muted)",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					Need help?{" "}
					<span style={{ color: "var(--gf-text)" }}>Contact support</span>
				</div>

				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						maxWidth: 440,
					}}
				>
					<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
						Sign in
					</div>
					<h2
						className="gf-display"
						style={{ fontSize: 34, fontWeight: 500, marginBottom: 12 }}
					>
						Continue with Twitch
					</h2>
					<p
						style={{
							fontSize: 14,
							color: "var(--gf-muted)",
							margin: 0,
							lineHeight: 1.55,
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						We use OAuth to verify it's you. Nothing is posted on your behalf.
					</p>

					<button
						type="button"
						className="gf-btn primary lg block"
						style={{ marginTop: 36 }}
						onClick={handleContinue}
					>
						Continue
						<ArrowRightIcon size={15} />
					</button>

					<div
						style={{
							marginTop: 44,
							display: "flex",
							alignItems: "center",
							gap: 14,
						}}
					>
						<div style={{ flex: 1, height: 1, background: "var(--gf-hl)" }} />
						<span className="gf-eyebrow">Land me on</span>
						<div style={{ flex: 1, height: 1, background: "var(--gf-hl)" }} />
					</div>

					<div style={{ marginTop: 18 }}>
						<RoleRow
							icon="eye"
							title="Viewer"
							sub="Browse live streamers, send GIFs."
							selected={role === "viewer"}
							onClick={() => setRole("viewer")}
						/>
						<RoleRow
							icon="monitor"
							title="Streamer"
							sub="Receive GIFs on your overlay."
							selected={role === "streamer"}
							onClick={() => setRole("streamer")}
						/>
					</div>

					<p
						style={{
							marginTop: 28,
							fontSize: 12,
							color: "var(--gf-muted-2)",
							lineHeight: 1.6,
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						You can change your default landing role anytime. Streamer
						enrollment is independent — you can be both at once.
					</p>
				</div>
			</div>
		</main>
	);
}
