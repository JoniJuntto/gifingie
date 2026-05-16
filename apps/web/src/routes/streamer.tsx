import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
	RepeatIcon,
	XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/streamer")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

function BigStat({
	label,
	value,
	delta,
}: {
	label: string;
	value: string;
	delta?: string;
}) {
	return (
		<div style={{ textAlign: "right" }}>
			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					justifyContent: "flex-end",
					gap: 8,
				}}
			>
				<span
					style={{
						fontFamily: "var(--gf-font-mono)",
						fontSize: 32,
						fontWeight: 300,
						letterSpacing: "-0.04em",
						color: "var(--gf-text)",
					}}
				>
					{value}
				</span>
				{delta && (
					<span
						style={{
							fontFamily: "var(--gf-font-mono)",
							fontSize: 13,
							color: "var(--gf-ok)",
						}}
					>
						{delta}
					</span>
				)}
			</div>
			<div
				style={{
					fontSize: 12,
					color: "var(--gf-muted)",
					marginTop: 2,
					fontFamily: "var(--gf-font-ui)",
				}}
			>
				{label}
			</div>
		</div>
	);
}

function RouteComponent() {
	const me = useQuery(trpc.me.get.queryOptions());
	const recent = useQuery(trpc.streamer.recentSubmissions.queryOptions());
	const pendingModeration = useQuery(
		trpc.streamer.pendingModeration.queryOptions(),
	);

	const enroll = useMutation(
		trpc.streamer.enroll.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Channel enrolled");
			},
		}),
	);
	const regenerate = useMutation(
		trpc.streamer.regenerateOverlayToken.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Overlay URL regenerated");
			},
		}),
	);
	const approve = useMutation(
		trpc.streamer.approveSubmission.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Approved");
			},
			onError: (e) => toast.error(e.message),
		}),
	);
	const reject = useMutation(
		trpc.streamer.rejectSubmission.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Rejected");
			},
			onError: (e) => toast.error(e.message),
		}),
	);
	const replay = useMutation(
		trpc.streamer.replaySubmission.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Replay queued");
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const profile = me.data?.streamerProfile;
	const overlayUrl = profile
		? `${window.location.origin}/overlay/${profile.overlayToken}`
		: "";
	const shareUrl = profile
		? `${window.location.origin}/s/${profile.twitchChannelLogin}`
		: "";

	const recentList = recent.data ?? [];
	const pendingList = pendingModeration.data ?? [];

	if (me.isLoading) {
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
				height: "100%",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Hero header */}
			<div
				style={{
					padding: "44px 40px 20px",
					display: "grid",
					gridTemplateColumns: "1fr auto",
					alignItems: "flex-end",
					gap: 24,
					flexShrink: 0,
				}}
			>
				<div>
					{profile ? (
						<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
							<span
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									color: "var(--gf-live)",
									fontWeight: 600,
									letterSpacing: "0.08em",
								}}
							>
								<span className="gf-dot live" />
								Overlay active
							</span>
						</div>
					) : (
						<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
							Streamer dashboard
						</div>
					)}
					<h1
						className="gf-display"
						style={{ fontSize: 52, color: "var(--gf-text)" }}
					>
						{profile ? (
							<>
								Overlay <span style={{ color: "var(--gf-muted-2)" }}>—</span>{" "}
								{profile.twitchDisplayName}
							</>
						) : (
							"Your dashboard"
						)}
					</h1>
				</div>

				{profile && (
					<div style={{ display: "flex", gap: 24 }}>
						<BigStat
							label="Recent submissions"
							value={String(recentList.length)}
						/>
						<BigStat
							label="Pending approval"
							value={String(pendingList.length)}
						/>
						<BigStat
							label="Share visits"
							value={String(profile.shareVisitCount ?? 0)}
						/>
					</div>
				)}
			</div>

			{/* OBS URL row */}
			<div style={{ padding: "4px 40px 20px", flexShrink: 0 }}>
				<div className="gf-eyebrow" style={{ marginBottom: 10 }}>
					OBS Browser Source
				</div>

				{profile ? (
					<>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 16,
								padding: "18px 0",
								borderTop: "1px solid var(--gf-hl)",
								borderBottom: "1px solid var(--gf-hl)",
							}}
						>
							<div
								style={{
									fontFamily: "var(--gf-font-mono)",
									fontSize: 15,
									letterSpacing: "-0.02em",
									color: "var(--gf-text)",
									flex: 1,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								<span style={{ color: "var(--gf-muted)" }}>
									{window.location.origin}/overlay/
								</span>
								<span style={{ color: "var(--gf-accent)" }}>
									{profile.overlayToken}
								</span>
							</div>
							<button
								type="button"
								className="gf-btn ghost sm"
								onClick={() => {
									navigator.clipboard.writeText(overlayUrl);
									toast.success("URL copied");
								}}
							>
								<CopyIcon size={13} />
								Copy
							</button>
							<button
								type="button"
								className="gf-btn ghost sm"
								onClick={() => window.open(overlayUrl, "_blank")}
							>
								<ExternalLinkIcon size={13} />
								Open
							</button>
							<button
								type="button"
								className="gf-btn ghost sm"
								disabled={regenerate.isPending}
								onClick={() => regenerate.mutate()}
							>
								<RefreshCwIcon size={13} />
								Regenerate
							</button>
						</div>
						<div
							style={{
								marginTop: 10,
								fontSize: 12,
								color: "var(--gf-muted)",
								letterSpacing: "-0.01em",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							Add as Browser Source · 1920×1080 · transparent
						</div>
					</>
				) : (
					<div
						style={{
							borderTop: "1px solid var(--gf-hl)",
							borderBottom: "1px solid var(--gf-hl)",
							padding: "18px 0",
						}}
					>
						<p
							style={{
								fontSize: 14,
								color: "var(--gf-muted)",
								margin: "0 0 16px",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							Enroll your channel to get an OBS browser-source URL.
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
			</div>

			{profile && (
				<div style={{ padding: "0 40px 20px", flexShrink: 0 }}>
					<div className="gf-eyebrow" style={{ marginBottom: 10 }}>
						Streamer share link
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 16,
							padding: "14px 0",
							borderTop: "1px solid var(--gf-hl)",
							borderBottom: "1px solid var(--gf-hl)",
						}}
					>
						<div
							style={{
								fontFamily: "var(--gf-font-mono)",
								fontSize: 15,
								letterSpacing: "-0.02em",
								color: "var(--gf-text)",
								flex: 1,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							<span style={{ color: "var(--gf-muted)" }}>
								{window.location.origin}/s/
							</span>
							<span style={{ color: "var(--gf-accent)" }}>
								{profile.twitchChannelLogin}
							</span>
						</div>
						<button
							type="button"
							className="gf-btn ghost sm"
							onClick={() => {
								navigator.clipboard.writeText(shareUrl);
								toast.success("Share URL copied");
							}}
						>
							<CopyIcon size={13} />
							Copy
						</button>
						<button
							type="button"
							className="gf-btn ghost sm"
							onClick={() => window.open(shareUrl, "_blank")}
						>
							<ExternalLinkIcon size={13} />
							Open
						</button>
					</div>
				</div>
			)}

			{/* Main split: preview + submissions */}
			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "grid",
					gridTemplateColumns: profile ? "1.1fr 1fr" : "1fr",
					borderTop: "1px solid var(--gf-hl)",
				}}
			>
				{/* Left: preview or moderation queue */}
				<div
					style={{
						padding: "20px 28px 24px 40px",
						display: "flex",
						flexDirection: "column",
						gap: 12,
						minHeight: 0,
						overflowY: "auto",
					}}
				>
					{profile && (
						<>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 14,
									flexShrink: 0,
								}}
							>
								<div className="gf-eyebrow">Live preview</div>
								<span
									style={{
										fontFamily: "var(--gf-font-mono)",
										fontSize: 11,
										color: "var(--gf-muted-2)",
									}}
								>
									1920 × 1080
								</span>
							</div>
							<div style={{ flex: 1, minHeight: 0 }}>
								<iframe
									style={{
										width: "100%",
										height: "100%",
										minHeight: 200,
										border: "none",
										background: "#000",
										borderRadius: 4,
									}}
									src={overlayUrl}
									title="Overlay preview"
								/>
							</div>
						</>
					)}

					{/* Moderation queue */}
					{pendingList.length > 0 && (
						<div style={{ flexShrink: 0 }}>
							<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
								Pending approval
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
								{pendingList.map((sub) => (
									<div
										key={sub.id}
										style={{
											display: "grid",
											gridTemplateColumns: "64px 1fr auto",
											gap: 12,
											alignItems: "center",
											padding: "10px 0",
											borderBottom: "1px solid var(--gf-hl)",
										}}
									>
										<img
											src={sub.previewUrl ?? sub.gifUrl}
											alt={sub.title}
											style={{
												width: 64,
												height: 40,
												objectFit: "cover",
												borderRadius: 3,
											}}
										/>
										<div style={{ minWidth: 0 }}>
											<div
												style={{
													fontSize: 13,
													fontWeight: 500,
													color: "var(--gf-text)",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													fontFamily: "var(--gf-font-ui)",
												}}
											>
												{sub.title}
											</div>
											<div
												style={{
													fontSize: 11,
													color: "var(--gf-muted)",
													fontFamily: "var(--gf-font-mono)",
												}}
											>
												{sub.source === "upload" ? "Custom upload" : "GIPHY"}
											</div>
											{sub.caption && (
												<div
													style={{
														fontSize: 12,
														color: "var(--gf-muted)",
														fontFamily: "var(--gf-font-ui)",
														marginTop: 3,
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{sub.caption}
												</div>
											)}
										</div>
										<div style={{ display: "flex", gap: 8 }}>
											<button
												type="button"
												className="gf-btn sm"
												style={{
													background: "var(--gf-ok)",
													color: "#fff",
													height: 28,
													padding: "0 10px",
												}}
												disabled={approve.isPending || reject.isPending}
												onClick={() => approve.mutate({ submissionId: sub.id })}
											>
												<CheckIcon size={11} />
											</button>
											<button
												type="button"
												className="gf-btn sm outline"
												style={{ height: 28, padding: "0 10px" }}
												disabled={approve.isPending || reject.isPending}
												onClick={() => reject.mutate({ submissionId: sub.id })}
											>
												<XIcon size={11} />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{!profile && pendingList.length === 0 && (
						<p
							style={{
								fontSize: 14,
								color: "var(--gf-muted)",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							Enroll your channel to start receiving GIF submissions.
						</p>
					)}
				</div>

				{/* Right: recent submissions */}
				{profile && (
					<div
						style={{
							borderLeft: "1px solid var(--gf-hl)",
							padding: "20px 40px 24px 28px",
							display: "flex",
							flexDirection: "column",
							minHeight: 0,
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								marginBottom: 12,
								flexShrink: 0,
							}}
						>
							<div className="gf-eyebrow">Recent submissions</div>
						</div>

						<div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
							{recentList.length === 0 && (
								<p
									style={{
										fontSize: 13,
										color: "var(--gf-muted)",
										fontFamily: "var(--gf-font-ui)",
									}}
								>
									No submissions yet.
								</p>
							)}
							{recentList.map((sub, i) => {
								const status =
									sub.moderationStatus === "rejected"
										? "blocked"
										: sub.moderationStatus === "pending"
											? "queued"
											: sub.displayedAt
												? "played"
												: "queued";
								const canReplay =
									sub.moderationStatus === "approved" && Boolean(sub.displayedAt);
								return (
									<div
										key={sub.id}
										style={{
											display: "grid",
											gridTemplateColumns: "52px 1fr auto auto",
											gap: 14,
											alignItems: "center",
											padding: "12px 0",
											borderBottom:
												i < recentList.length - 1
													? "1px solid var(--gf-hl)"
													: "none",
										}}
									>
										<img
											src={sub.previewUrl ?? sub.gifUrl}
											alt={sub.title}
											style={{
												width: 52,
												height: 34,
												objectFit: "cover",
												borderRadius: 3,
											}}
										/>
										<div style={{ minWidth: 0 }}>
											<div
												style={{
													fontSize: 13,
													fontWeight: 500,
													color: "var(--gf-text)",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													fontFamily: "var(--gf-font-ui)",
												}}
											>
												{sub.title}
											</div>
											<div
												style={{
													fontSize: 11,
													color: "var(--gf-muted)",
													fontFamily: "var(--gf-font-mono)",
													marginTop: 2,
												}}
											>
												{sub.source === "upload" ? "upload" : "giphy"}
											</div>
											{sub.caption && (
												<div
													style={{
														fontSize: 12,
														color: "var(--gf-muted)",
														fontFamily: "var(--gf-font-ui)",
														marginTop: 3,
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{sub.caption}
												</div>
											)}
										</div>

										{/* Status */}
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												gap: 6,
												fontSize: 12,
												color:
													status === "played"
														? "var(--gf-ok)"
														: status === "queued"
															? "var(--gf-accent)"
															: "var(--gf-live)",
												fontFamily: "var(--gf-font-ui)",
												fontWeight: 500,
												textAlign: "right",
											}}
										>
											<span
												className={`gf-dot ${status === "played" ? "ok" : status === "queued" ? "queue" : "live"}`}
											/>
											{status === "played"
												? "Played"
												: status === "queued"
													? "Queued"
													: "Blocked"}
										</span>

										{canReplay && (
											<button
												type="button"
												className="gf-btn ghost sm"
												disabled={replay.isPending}
												onClick={() => replay.mutate({ submissionId: sub.id })}
											>
												<RepeatIcon size={12} />
												Replay
											</button>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
