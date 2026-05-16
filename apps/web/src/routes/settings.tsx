import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { EyeIcon, MonitorIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/settings")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

type NavSection = "role" | "channel" | "playback" | "moderation" | "session";

const NAV_ITEMS: { id: NavSection; label: string }[] = [
	{ id: "role", label: "Role & landing" },
	{ id: "channel", label: "Streamer channel" },
	{ id: "playback", label: "Overlay playback" },
	{ id: "moderation", label: "Moderation" },
	{ id: "session", label: "Session" },
];

function SettingRow({
	title,
	sub,
	children,
}: {
	title: string;
	sub: string;
	children: React.ReactNode;
}) {
	return (
		<div className="gf-setting-row">
			<div>
				<div
					style={{
						fontSize: 15,
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
						marginTop: 4,
						lineHeight: 1.55,
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					{sub}
				</div>
			</div>
			<div style={{ display: "flex", alignItems: "flex-start" }}>
				{children}
			</div>
		</div>
	);
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
	const initials = name
		.split(/[\s_.@]/)
		.filter(Boolean)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
	const hue = hash % 360;
	return (
		<span
			className="gf-avatar"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.36,
				background: `linear-gradient(135deg, hsl(${hue} 60% 50%), hsl(${(hue + 40) % 360} 60% 40%))`,
			}}
		>
			{initials}
		</span>
	);
}

function RouteComponent() {
	const navigate = useNavigate();
	const [activeSection, setActiveSection] = useState<NavSection>("role");
	const [gifDisplaySeconds, setGifDisplaySeconds] = useState("10");

	const me = useQuery(trpc.me.get.queryOptions());
	const { data: session } = authClient.useSession();

	const setRole = useMutation(
		trpc.me.setRole.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(),
		}),
	);
	const enroll = useMutation(
		trpc.streamer.enroll.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Channel enrolled");
			},
		}),
	);
	const updateOverlaySettings = useMutation(
		trpc.streamer.updateOverlaySettings.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Playback settings saved");
			},
			onError: (e) => toast.error(e.message),
		}),
	);
	const updateModerationSettings = useMutation(
		trpc.streamer.updateModerationSettings.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Moderation settings saved");
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	useEffect(() => {
		const saved = me.data?.streamerProfile?.gifDisplaySeconds;
		if (typeof saved === "number") setGifDisplaySeconds(String(saved));
	}, [me.data?.streamerProfile?.gifDisplaySeconds]);

	const profile = me.data?.streamerProfile;
	const shareUrl = profile
		? `${window.location.origin}/s/${profile.twitchChannelLogin}`
		: "";

	return (
		<div
			className="gf-page"
			style={{
				height: "100%",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "grid",
					gridTemplateColumns: "220px 1fr",
					overflow: "hidden",
				}}
			>
				{/* Sidebar */}
				<aside
					style={{
						borderRight: "1px solid var(--gf-hl)",
						padding: "40px 28px",
						display: "flex",
						flexDirection: "column",
					}}
				>
					<div className="gf-eyebrow" style={{ marginBottom: 22 }}>
						Settings
					</div>

					{NAV_ITEMS.map(({ id, label }) => (
						<button
							key={id}
							type="button"
							onClick={() => setActiveSection(id)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "10px 0",
								fontSize: 14,
								fontWeight: 500,
								color:
									activeSection === id ? "var(--gf-text)" : "var(--gf-muted)",
								cursor: "pointer",
								letterSpacing: "-0.01em",
								background: "transparent",
								border: "none",
								textAlign: "left",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							{activeSection === id && (
								<span
									style={{
										width: 3,
										height: 14,
										background: "var(--gf-accent)",
										display: "inline-block",
										flexShrink: 0,
									}}
								/>
							)}
							<span style={{ marginLeft: activeSection === id ? 0 : 13 }}>
								{label}
							</span>
						</button>
					))}

					<div style={{ marginTop: "auto" }}>
						<button
							type="button"
							className="gf-btn danger"
							onClick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => navigate({ to: "/login" }),
									},
								})
							}
						>
							Sign out
						</button>
					</div>
				</aside>

				{/* Content */}
				<div style={{ padding: "40px 56px", overflowY: "auto" }}>
					{activeSection === "role" && (
						<>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Settings · Role &amp; landing
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 14 }}
							>
								Role &amp; channel.
							</h2>
							<p
								style={{
									margin: 0,
									fontSize: 14,
									color: "var(--gf-muted)",
									maxWidth: 540,
									lineHeight: 1.55,
									fontFamily: "var(--gf-font-ui)",
									marginBottom: 32,
								}}
							>
								Your landing role controls which page you see after sign-in.
								Streamer enrollment is independent.
							</p>

							<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
								<SettingRow
									title="Default landing role"
									sub="What you see after sign-in."
								>
									<div className="gf-seg">
										{(
											[
												{ value: "viewer", label: "Viewer", Icon: EyeIcon },
												{
													value: "streamer",
													label: "Streamer",
													Icon: MonitorIcon,
												},
											] as const
										).map(({ value, label, Icon }) => (
											<button
												key={value}
												type="button"
												className={`gf-seg-opt${me.data?.selectedRole === value ? "active" : ""}`}
												onClick={() => setRole.mutate({ role: value })}
											>
												<Icon size={12} />
												{label}
											</button>
										))}
									</div>
								</SettingRow>
							</div>
						</>
					)}

					{activeSection === "channel" && (
						<>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Settings · Streamer channel
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 32 }}
							>
								Channel enrollment.
							</h2>

							<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
								<SettingRow
									title="Enrolled channel"
									sub="Enrolled channels can receive GIFs on their overlay."
								>
									{profile ? (
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: 14,
												width: "100%",
											}}
										>
											<Avatar name={profile.twitchDisplayName} size={40} />
											<div style={{ flex: 1 }}>
												<div
													style={{
														fontSize: 15,
														fontWeight: 500,
														letterSpacing: "-0.01em",
														color: "var(--gf-text)",
														fontFamily: "var(--gf-font-ui)",
													}}
												>
													{profile.twitchDisplayName}
												</div>
												<div
													style={{
														fontSize: 12,
														color: "var(--gf-muted)",
														fontFamily: "var(--gf-font-mono)",
														marginTop: 2,
													}}
												>
													@{profile.twitchChannelLogin}
												</div>
											</div>
											<span
												style={{
													display: "inline-flex",
													alignItems: "center",
													gap: 6,
													fontSize: 12,
													color: "var(--gf-ok)",
													fontFamily: "var(--gf-font-ui)",
													fontWeight: 500,
												}}
											>
												<span className="gf-dot ok" />
												Enrolled
											</span>
										</div>
									) : (
										<div>
											<p
												style={{
													fontSize: 14,
													color: "var(--gf-muted)",
													margin: "0 0 16px",
													fontFamily: "var(--gf-font-ui)",
												}}
											>
												No channel enrolled.
											</p>
											<button
												type="button"
												className="gf-btn primary"
												disabled={enroll.isPending}
												onClick={() => enroll.mutate()}
											>
												{enroll.isPending ? "Enrolling…" : "Enroll channel"}
											</button>
										</div>
									)}
								</SettingRow>

								{profile && (
									<SettingRow
										title="Streamer share URL"
										sub="Send this link to viewers so they can land directly on your submission page."
									>
										<div style={{ width: "100%" }}>
											<div className="gf-code" style={{ marginBottom: 12 }}>
												<span style={{ color: "var(--gf-muted)" }}>
													share_url ={" "}
												</span>
												<span style={{ color: "var(--gf-accent)" }}>
													{shareUrl}
												</span>
											</div>
											<div
												style={{
													display: "flex",
													gap: 24,
													alignItems: "center",
												}}
											>
												<button
													type="button"
													className="gf-btn link"
													onClick={() => {
														navigator.clipboard.writeText(shareUrl);
														toast.success("Share URL copied");
													}}
												>
													Copy share URL
												</button>
												<span
													style={{
														fontSize: 12,
														color: "var(--gf-muted)",
														fontFamily: "var(--gf-font-mono)",
													}}
												>
													{profile.shareVisitCount ?? 0} visits
												</span>
											</div>
										</div>
									</SettingRow>
								)}

								{profile && (
									<SettingRow
										title="Overlay token"
										sub="Rotating invalidates the previous OBS URL — update your browser source."
									>
										<div style={{ width: "100%" }}>
											<div className="gf-code" style={{ marginBottom: 12 }}>
												<span style={{ color: "var(--gf-muted)" }}>
													overlay_token ={" "}
												</span>
												<span style={{ color: "var(--gf-accent)" }}>
													{profile.overlayToken}
												</span>
											</div>
											<div
												style={{
													display: "flex",
													gap: 24,
													alignItems: "center",
												}}
											>
												<button
													type="button"
													className="gf-btn link"
													onClick={() => {
														navigator.clipboard.writeText(
															`${window.location.origin}/overlay/${profile.overlayToken}`,
														);
														toast.success("OBS URL copied");
													}}
												>
													Copy OBS URL
												</button>
												<button
													type="button"
													className="gf-btn link"
													onClick={() => trpc.streamer.regenerateOverlayToken}
												>
													Regenerate token
												</button>
											</div>
										</div>
									</SettingRow>
								)}
							</div>
						</>
					)}

					{activeSection === "playback" && (
						<>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Settings · Overlay playback
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 32 }}
							>
								Playback duration.
							</h2>

							<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
								<SettingRow
									title="GIF display duration"
									sub="How long each queued GIF stays visible in OBS (1–60 seconds)."
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 16,
											width: "100%",
										}}
									>
										<input
											type="number"
											className="gf-input boxed"
											style={{
												width: 100,
												fontSize: 22,
												fontFamily: "var(--gf-font-mono)",
												fontWeight: 300,
												textAlign: "center",
											}}
											min={1}
											max={60}
											value={gifDisplaySeconds}
											disabled={!profile}
											onChange={(e) => setGifDisplaySeconds(e.target.value)}
										/>
										<span
											style={{
												fontSize: 14,
												color: "var(--gf-muted)",
												fontFamily: "var(--gf-font-ui)",
											}}
										>
											seconds
										</span>
										<button
											type="button"
											className="gf-btn primary"
											disabled={!profile || updateOverlaySettings.isPending}
											style={{ marginLeft: "auto" }}
											onClick={() =>
												updateOverlaySettings.mutate({
													gifDisplaySeconds: Number(gifDisplaySeconds),
												})
											}
										>
											{updateOverlaySettings.isPending ? "Saving…" : "Save"}
										</button>
									</div>
								</SettingRow>
							</div>
						</>
					)}

					{activeSection === "moderation" && (
						<>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Settings · Moderation
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 32 }}
							>
								Submission review.
							</h2>

							<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
								<SettingRow
									title="Moderate GIPHY submissions"
									sub="When enabled, GIPHY picks enter the same dashboard queue as custom uploads."
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 14,
										}}
									>
										<span
											style={{
												fontSize: 13,
												color: "var(--gf-muted)",
												fontFamily: "var(--gf-font-ui)",
											}}
										>
											{profile?.moderateGiphySubmissions
												? "Enabled"
												: "Disabled"}
										</span>
										<button
											type="button"
											className="gf-btn sm outline"
											disabled={!profile || updateModerationSettings.isPending}
											onClick={() =>
												updateModerationSettings.mutate({
													moderateGiphySubmissions:
														!profile?.moderateGiphySubmissions,
												})
											}
										>
											{profile?.moderateGiphySubmissions ? "Disable" : "Enable"}
										</button>
									</div>
								</SettingRow>
							</div>
						</>
					)}

					{activeSection === "session" && (
						<>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Settings · Session
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 32 }}
							>
								Your session.
							</h2>

							<div style={{ borderTop: "1px solid var(--gf-hl)" }}>
								<SettingRow
									title="Signed in as"
									sub="Your Twitch account linked to gifingie."
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 14,
											width: "100%",
										}}
									>
										<Avatar name={session?.user.name ?? "User"} size={36} />
										<div style={{ flex: 1 }}>
											<div
												style={{
													fontSize: 15,
													fontWeight: 500,
													color: "var(--gf-text)",
													fontFamily: "var(--gf-font-ui)",
												}}
											>
												{session?.user.name}
											</div>
											{session?.user.email && (
												<div
													style={{
														fontSize: 12,
														color: "var(--gf-muted)",
														fontFamily: "var(--gf-font-mono)",
														marginTop: 2,
													}}
												>
													{session.user.email}
												</div>
											)}
										</div>
										<button
											type="button"
											className="gf-btn danger"
											onClick={() =>
												authClient.signOut({
													fetchOptions: {
														onSuccess: () => navigate({ to: "/login" }),
													},
												})
											}
										>
											Sign out
										</button>
									</div>
								</SettingRow>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
