import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { EyeIcon, MonitorIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
type OverlayLayout = {
	overlayGifXPercent: number;
	overlayGifYPercent: number;
	overlayGifWidthPercent: number;
	overlayGifHeightPercent: number;
};

const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
	overlayGifXPercent: 50,
	overlayGifYPercent: 78,
	overlayGifWidthPercent: 28,
	overlayGifHeightPercent: 22,
};

type ViewerAccessLevel = "everyone" | "followers" | "subscribers";

const VIEWER_ACCESS_OPTIONS: { value: ViewerAccessLevel; label: string }[] = [
	{ value: "everyone", label: "Everyone" },
	{ value: "followers", label: "Followers" },
	{ value: "subscribers", label: "Subscribers" },
];

const TWITCH_SUBSCRIPTIONS_SCOPE = "channel:read:subscriptions";
const TWITCH_REDEMPTIONS_SCOPE = "channel:manage:redemptions";
const TWITCH_BITS_SCOPE = "bits:read";

type PriceCurrency = "none" | "channel_points" | "bits";

const PRICE_CURRENCY_OPTIONS: { value: PriceCurrency; label: string }[] = [
	{ value: "none", label: "Free" },
	{ value: "channel_points", label: "Channel points" },
	{ value: "bits", label: "Bits" },
];

function moderationSettingsInput(
	profile: {
		moderateGiphySubmissions?: boolean;
		allowCustomUploads?: boolean;
		allowGifSubmissions?: boolean;
		allowSoundSubmissions?: boolean;
		giphyAccess?: ViewerAccessLevel;
		uploadAccess?: ViewerAccessLevel;
	} | null
	| undefined,
	overrides: Partial<{
		moderateGiphySubmissions: boolean;
		allowCustomUploads: boolean;
		allowGifSubmissions: boolean;
		allowSoundSubmissions: boolean;
		giphyAccess: ViewerAccessLevel;
		uploadAccess: ViewerAccessLevel;
	}> = {},
) {
	return {
		moderateGiphySubmissions: profile?.moderateGiphySubmissions ?? false,
		allowCustomUploads: profile?.allowCustomUploads ?? false,
		allowGifSubmissions: profile?.allowGifSubmissions ?? true,
		allowSoundSubmissions: profile?.allowSoundSubmissions ?? true,
		giphyAccess: profile?.giphyAccess ?? "everyone",
		uploadAccess: profile?.uploadAccess ?? "everyone",
		...overrides,
	};
}

const NAV_ITEMS: { id: NavSection; label: string }[] = [
	{ id: "role", label: "Role & landing" },
	{ id: "channel", label: "Streamer channel" },
	{ id: "playback", label: "Overlay playback & position" },
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

function OverlayPositionPreview({
	layout,
	disabled,
	onChange,
}: {
	layout: OverlayLayout;
	disabled: boolean;
	onChange: (layout: OverlayLayout) => void;
}) {
	const previewRef = useRef<HTMLDivElement | null>(null);
	const interactionRef = useRef<{
		mode: "move" | "resize";
		startX: number;
		startY: number;
		startLayout: OverlayLayout;
	} | null>(null);
	const safeLayout = clampOverlayLayout(layout);

	function handlePointerDown(
		event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
		mode: "move" | "resize",
	) {
		if (disabled) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		interactionRef.current = {
			mode,
			startX: event.clientX,
			startY: event.clientY,
			startLayout: safeLayout,
		};
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		const interaction = interactionRef.current;
		const preview = previewRef.current;
		if (!interaction || !preview) return;

		const rect = preview.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		const dx = ((event.clientX - interaction.startX) / rect.width) * 100;
		const dy = ((event.clientY - interaction.startY) / rect.height) * 100;

		if (interaction.mode === "move") {
			onChange(
				clampOverlayLayout({
					...interaction.startLayout,
					overlayGifXPercent: interaction.startLayout.overlayGifXPercent + dx,
					overlayGifYPercent: interaction.startLayout.overlayGifYPercent + dy,
				}),
			);
			return;
		}

		onChange(
			clampOverlayLayout({
				...interaction.startLayout,
				overlayGifWidthPercent:
					interaction.startLayout.overlayGifWidthPercent + dx,
				overlayGifHeightPercent:
					interaction.startLayout.overlayGifHeightPercent + dy,
			}),
		);
	}

	function handlePointerUp() {
		interactionRef.current = null;
	}

	return (
		<div style={{ width: "100%" }}>
			<div
				ref={previewRef}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				style={{
					position: "relative",
					aspectRatio: "16 / 9",
					width: "100%",
					minHeight: 260,
					overflow: "hidden",
					border: "1px solid var(--gf-hl2)",
					borderRadius: 4,
					background:
						"linear-gradient(135deg, rgba(20,17,13,0.88), rgba(20,17,13,0.70))",
					opacity: disabled ? 0.45 : 1,
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage:
							"linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
						backgroundSize: "6.25% 11.11%",
					}}
				/>
				<div
					onPointerDown={(event) => handlePointerDown(event, "move")}
					style={{
						position: "absolute",
						left: `${safeLayout.overlayGifXPercent}%`,
						top: `${safeLayout.overlayGifYPercent}%`,
						width: `${safeLayout.overlayGifWidthPercent}%`,
						height: `${safeLayout.overlayGifHeightPercent}%`,
						transform: "translate(-50%, -50%)",
						cursor: disabled ? "default" : "move",
						border: "1px solid rgba(255,255,255,0.34)",
						boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
						background: "rgba(0,0,0,0.70)",
						display: "flex",
						flexDirection: "column",
						minWidth: 54,
						minHeight: 42,
					}}
				>
					<div
						style={{
							flex: 1,
							minHeight: 0,
							background:
								"radial-gradient(circle at 30% 30%, #ffcf7a 0, #ff6b35 32%, #33211a 72%)",
							display: "grid",
							placeItems: "center",
							color: "white",
							fontFamily: "var(--gf-font-mono)",
							fontSize: 13,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							overflow: "hidden",
						}}
					>
						GIF
					</div>
					<div
						style={{
							height: 4,
							background: "rgba(255,255,255,0.18)",
						}}
					>
						<div
							style={{
								width: "62%",
								height: "100%",
								background: "var(--gf-accent)",
							}}
						/>
					</div>
					<button
						type="button"
						aria-label="Resize overlay GIF preview"
						onPointerDown={(event) => {
							event.stopPropagation();
							handlePointerDown(event, "resize");
						}}
						disabled={disabled}
						style={{
							position: "absolute",
							right: -6,
							bottom: -6,
							width: 18,
							height: 18,
							borderRadius: 3,
							border: "1px solid rgba(255,255,255,0.55)",
							background: "var(--gf-accent)",
							cursor: disabled ? "default" : "nwse-resize",
						}}
					/>
				</div>
			</div>
		</div>
	);
}

function RouteComponent() {
	const navigate = useNavigate();
	const [activeSection, setActiveSection] = useState<NavSection>("role");
	const [gifDisplaySeconds, setGifDisplaySeconds] = useState("10");
	const [overlayLayout, setOverlayLayout] = useState<OverlayLayout>(
		DEFAULT_OVERLAY_LAYOUT,
	);

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
	const updatePricingSettings = useMutation(
		trpc.streamer.updatePricingSettings.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Pricing settings saved");
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const [giphyPriceCurrency, setGiphyPriceCurrency] =
		useState<PriceCurrency>("none");
	const [giphyPriceAmount, setGiphyPriceAmount] = useState("");
	const [uploadPriceCurrency, setUploadPriceCurrency] =
		useState<PriceCurrency>("none");
	const [uploadPriceAmount, setUploadPriceAmount] = useState("");
	const [soundPriceCurrency, setSoundPriceCurrency] =
		useState<PriceCurrency>("none");
	const [soundPriceAmount, setSoundPriceAmount] = useState("");

	useEffect(() => {
		const saved = me.data?.streamerProfile;
		if (!saved) return;

		setGifDisplaySeconds(String(saved.gifDisplaySeconds));
		setOverlayLayout(
			clampOverlayLayout({
				overlayGifXPercent:
					saved.overlayGifXPercent ?? DEFAULT_OVERLAY_LAYOUT.overlayGifXPercent,
				overlayGifYPercent:
					saved.overlayGifYPercent ?? DEFAULT_OVERLAY_LAYOUT.overlayGifYPercent,
				overlayGifWidthPercent:
					saved.overlayGifWidthPercent ??
					DEFAULT_OVERLAY_LAYOUT.overlayGifWidthPercent,
				overlayGifHeightPercent:
					saved.overlayGifHeightPercent ??
					DEFAULT_OVERLAY_LAYOUT.overlayGifHeightPercent,
			}),
		);
		setGiphyPriceCurrency(saved.giphyPriceCurrency ?? "none");
		setGiphyPriceAmount(
			saved.giphyPriceAmount ? String(saved.giphyPriceAmount) : "",
		);
		setUploadPriceCurrency(saved.uploadPriceCurrency ?? "none");
		setUploadPriceAmount(
			saved.uploadPriceAmount ? String(saved.uploadPriceAmount) : "",
		);
		setSoundPriceCurrency(saved.soundPriceCurrency ?? "none");
		setSoundPriceAmount(
			saved.soundPriceAmount ? String(saved.soundPriceAmount) : "",
		);
	}, [me.data?.streamerProfile]);

	const profile = me.data?.streamerProfile;
	const needsSubscriptionScopeReconnect =
		profile?.giphyAccess === "subscribers" ||
		profile?.uploadAccess === "subscribers";
	const needsRedemptionsScopeReconnect =
		giphyPriceCurrency === "channel_points" ||
		uploadPriceCurrency === "channel_points" ||
		soundPriceCurrency === "channel_points";
	const needsBitsScopeReconnect =
		giphyPriceCurrency === "bits" ||
		uploadPriceCurrency === "bits" ||
		soundPriceCurrency === "bits";

	const reconnectTwitchForSubscriptions = () => {
		authClient.signIn.social({
			provider: "twitch",
			callbackURL: `${window.location.origin}/settings`,
			scopes: [
				"user:read:moderated_channels",
				TWITCH_SUBSCRIPTIONS_SCOPE,
			],
		});
	};

	const reconnectTwitchForPricing = () => {
		authClient.signIn.social({
			provider: "twitch",
			callbackURL: `${window.location.origin}/settings`,
			scopes: [
				"user:read:moderated_channels",
				TWITCH_SUBSCRIPTIONS_SCOPE,
				TWITCH_REDEMPTIONS_SCOPE,
				TWITCH_BITS_SCOPE,
			],
		});
	};

	function savePricingSettings() {
		if (!profile) return;
		const giphyAmount =
			giphyPriceCurrency === "none"
				? null
				: Number.parseInt(giphyPriceAmount, 10);
		const uploadAmount =
			uploadPriceCurrency === "none"
				? null
				: Number.parseInt(uploadPriceAmount, 10);
		const soundAmount =
			soundPriceCurrency === "none"
				? null
				: Number.parseInt(soundPriceAmount, 10);
		updatePricingSettings.mutate({
			giphyPriceCurrency,
			giphyPriceAmount: giphyAmount,
			uploadPriceCurrency,
			uploadPriceAmount: uploadAmount,
			soundPriceCurrency,
			soundPriceAmount: soundAmount,
		});
	}

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
												},
											] as const
										).map(({ value, label}) => (
											<button
												key={value}
												type="button"
												className={`gf-seg-opt${me.data?.selectedRole === value ? "active" : ""} p-2`}
												onClick={() => setRole.mutate({ role: value })}
											>
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
								Settings · Overlay playback &amp; position
							</div>
							<h2
								className="gf-display"
								style={{ fontSize: 42, fontWeight: 300, marginBottom: 32 }}
							>
								Overlay GIF card.
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
													...clampOverlayLayout(overlayLayout),
												})
											}
										>
											{updateOverlaySettings.isPending ? "Saving…" : "Save"}
										</button>
									</div>
								</SettingRow>
								<SettingRow
									title="GIF position preview"
									sub="Drag the preview card to move it. Use the handle to resize it."
								>
									<OverlayPositionPreview
										layout={overlayLayout}
										disabled={!profile}
										onChange={setOverlayLayout}
									/>
								</SettingRow>
								<SettingRow
									title="Precise layout"
									sub="Percent-based values map to the full OBS browser source."
								>
									<div
										style={{
											display: "grid",
											gridTemplateColumns: "repeat(4, minmax(78px, 1fr))",
											gap: 12,
											width: "100%",
										}}
									>
										{(
											[
												["X", "overlayGifXPercent", 0, 100],
												["Y", "overlayGifYPercent", 0, 100],
												["W", "overlayGifWidthPercent", 5, 100],
												["H", "overlayGifHeightPercent", 5, 100],
											] as const
										).map(([label, key, min, max]) => (
											<label
												key={key}
												style={{
													display: "grid",
													gap: 8,
													fontSize: 11,
													color: "var(--gf-muted)",
													fontFamily: "var(--gf-font-mono)",
													letterSpacing: "0.06em",
													textTransform: "uppercase",
												}}
											>
												{label}
												<input
													type="number"
													className="gf-input boxed"
													min={min}
													max={max}
													value={overlayLayout[key]}
													disabled={!profile}
													onChange={(event) =>
														setOverlayLayout((current) =>
															clampOverlayLayout({
																...current,
																[key]: Number(event.target.value),
															}),
														)
													}
												/>
											</label>
										))}
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
												updateModerationSettings.mutate(
													moderationSettingsInput(profile, {
														moderateGiphySubmissions:
															!profile?.moderateGiphySubmissions,
													}),
												)
											}
										>
											{profile?.moderateGiphySubmissions ? "Disable" : "Enable"}
										</button>
									</div>
								</SettingRow>
								<SettingRow
									title="Allow custom uploads"
									sub="When enabled, viewers can submit their own images and GIFs from your share page."
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
											{profile?.allowCustomUploads ? "Enabled" : "Disabled"}
										</span>
										<button
											type="button"
											className="gf-btn sm outline"
											disabled={!profile || updateModerationSettings.isPending}
											onClick={() =>
												updateModerationSettings.mutate(
													moderationSettingsInput(profile, {
														allowCustomUploads: !profile?.allowCustomUploads,
													}),
												)
											}
										>
											{profile?.allowCustomUploads ? "Disable" : "Enable"}
										</button>
									</div>
								</SettingRow>
								<SettingRow
									title="Allow GIF submissions"
									sub="When disabled, viewers cannot send GIPHY picks or custom image uploads."
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
											{profile?.allowGifSubmissions !== false
												? "Enabled"
												: "Disabled"}
										</span>
										<button
											type="button"
											className="gf-btn sm outline"
											disabled={!profile || updateModerationSettings.isPending}
											onClick={() =>
												updateModerationSettings.mutate(
													moderationSettingsInput(profile, {
														allowGifSubmissions:
															profile?.allowGifSubmissions === false,
													}),
												)
											}
										>
											{profile?.allowGifSubmissions !== false
												? "Disable"
												: "Enable"}
										</button>
									</div>
								</SettingRow>
								<SettingRow
									title="Allow sound uploads"
									sub="When disabled, viewers cannot upload or resend sounds. Enable “Control audio via OBS” on your browser source so sounds reach the stream."
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
											{profile?.allowSoundSubmissions !== false
												? "Enabled"
												: "Disabled"}
										</span>
										<button
											type="button"
											className="gf-btn sm outline"
											disabled={!profile || updateModerationSettings.isPending}
											onClick={() =>
												updateModerationSettings.mutate(
													moderationSettingsInput(profile, {
														allowSoundSubmissions:
															profile?.allowSoundSubmissions === false,
													}),
												)
											}
										>
											{profile?.allowSoundSubmissions !== false
												? "Disable"
												: "Enable"}
										</button>
									</div>
								</SettingRow>
								<SettingRow
									title="Who can send GIPHY GIFs"
									sub='Anonymous viewers can send only when set to "Everyone". Followers and subscribers require Twitch sign-in.'
								>
									<select
										className="gf-input boxed"
										disabled={!profile || updateModerationSettings.isPending}
										value={profile?.giphyAccess ?? "everyone"}
										onChange={(event) =>
											updateModerationSettings.mutate(
												moderationSettingsInput(profile, {
													giphyAccess: event.target
														.value as ViewerAccessLevel,
												}),
											)
										}
									>
										{VIEWER_ACCESS_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</SettingRow>
								<SettingRow
									title="Who can upload custom images"
									sub="Requires custom uploads to be enabled. Uploads always need Twitch sign-in."
								>
									<select
										className="gf-input boxed"
										disabled={!profile || updateModerationSettings.isPending}
										value={profile?.uploadAccess ?? "everyone"}
										onChange={(event) =>
											updateModerationSettings.mutate(
												moderationSettingsInput(profile, {
													uploadAccess: event.target
														.value as ViewerAccessLevel,
												}),
											)
										}
									>
										{VIEWER_ACCESS_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</SettingRow>
								{needsSubscriptionScopeReconnect && (
									<SettingRow
										title="Twitch reconnect required"
										sub="Subscriber-only access needs the channel:read:subscriptions scope on your Twitch account."
									>
										<button
											type="button"
											className="gf-btn sm"
											onClick={reconnectTwitchForSubscriptions}
										>
											Reconnect Twitch
										</button>
									</SettingRow>
								)}

								<SettingRow
									title="GIPHY price"
									sub="Viewers pay on Twitch (channel points or bits), then send here. Leave free to skip payment."
								>
									<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
										<select
											className="gf-input boxed"
											value={giphyPriceCurrency}
											disabled={!profile || updatePricingSettings.isPending}
											onChange={(event) =>
												setGiphyPriceCurrency(
													event.target.value as PriceCurrency,
												)
											}
										>
											{PRICE_CURRENCY_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
										<input
											className="gf-input boxed"
											type="number"
											min={1}
											disabled={
												!profile ||
												updatePricingSettings.isPending ||
												giphyPriceCurrency === "none"
											}
											value={giphyPriceAmount}
											onChange={(event) =>
												setGiphyPriceAmount(event.target.value)
											}
											placeholder="Amount"
											style={{ width: 100 }}
										/>
									</div>
								</SettingRow>
								<SettingRow
									title="Custom upload price"
									sub="Separate from GIPHY pricing. Requires custom uploads to be enabled."
								>
									<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
										<select
											className="gf-input boxed"
											value={uploadPriceCurrency}
											disabled={
												!profile ||
												!profile.allowCustomUploads ||
												updatePricingSettings.isPending
											}
											onChange={(event) =>
												setUploadPriceCurrency(
													event.target.value as PriceCurrency,
												)
											}
										>
											{PRICE_CURRENCY_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
										<input
											className="gf-input boxed"
											type="number"
											min={1}
											disabled={
												!profile ||
												!profile.allowCustomUploads ||
												updatePricingSettings.isPending ||
												uploadPriceCurrency === "none"
											}
											value={uploadPriceAmount}
											onChange={(event) =>
												setUploadPriceAmount(event.target.value)
											}
											placeholder="Amount"
											style={{ width: 100 }}
										/>
									</div>
								</SettingRow>
								<SettingRow
									title="Sound price"
									sub="Separate from GIF pricing. Requires sound submissions to be enabled."
								>
									<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
										<select
											className="gf-input boxed"
											value={soundPriceCurrency}
											disabled={
												!profile ||
												profile.allowSoundSubmissions === false ||
												updatePricingSettings.isPending
											}
											onChange={(event) =>
												setSoundPriceCurrency(
													event.target.value as PriceCurrency,
												)
											}
										>
											{PRICE_CURRENCY_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
										<input
											className="gf-input boxed"
											type="number"
											min={1}
											disabled={
												!profile ||
												profile.allowSoundSubmissions === false ||
												updatePricingSettings.isPending ||
												soundPriceCurrency === "none"
											}
											value={soundPriceAmount}
											onChange={(event) =>
												setSoundPriceAmount(event.target.value)
											}
											placeholder="Amount"
											style={{ width: 100 }}
										/>
									</div>
								</SettingRow>
								<SettingRow
									title="Save pricing"
									sub="Creates or updates Twitch channel point rewards when needed."
								>
									<button
										type="button"
										className="gf-btn sm"
										disabled={!profile || updatePricingSettings.isPending}
										onClick={savePricingSettings}
									>
										Save pricing
									</button>
								</SettingRow>
								{needsRedemptionsScopeReconnect && (
									<SettingRow
										title="Twitch reconnect for channel points"
										sub="Channel point rewards require the channel:manage:redemptions scope."
									>
										<button
											type="button"
											className="gf-btn sm"
											onClick={reconnectTwitchForPricing}
										>
											Reconnect Twitch
										</button>
									</SettingRow>
								)}
								{needsBitsScopeReconnect && (
									<SettingRow
										title="Twitch reconnect for bits"
										sub="Bits pricing requires the bits:read scope for cheer EventSub notifications."
									>
										<button
											type="button"
											className="gf-btn sm"
											onClick={reconnectTwitchForPricing}
										>
											Reconnect Twitch
										</button>
									</SettingRow>
								)}
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
