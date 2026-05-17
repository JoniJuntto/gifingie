import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckIcon, RefreshCwIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { appUrl, authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/moderation")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

const TWITCH_MODERATION_SCOPES = ["user:read:moderated_channels"];

function RouteComponent() {
	const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
		null,
	);
	const channels = useQuery({
		...trpc.moderation.myChannels.queryOptions(),
		retry: false,
	});
	const pending = useQuery({
		...trpc.moderation.pendingSubmissions.queryOptions({
			streamerProfileId: selectedProfileId ?? "",
		}),
		enabled: Boolean(selectedProfileId),
		retry: false,
	});

	const approve = useMutation(
		trpc.moderation.approveSubmission.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Approved");
			},
			onError: (e) => toast.error(e.message),
		}),
	);
	const reject = useMutation(
		trpc.moderation.rejectSubmission.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Rejected");
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const channelList = channels.data?.channels ?? [];
	const selectedChannel =
		channelList.find((channel) => channel.id === selectedProfileId) ?? null;
	const pendingList = pending.data ?? [];

	useEffect(() => {
		if (selectedProfileId || channelList.length === 0) return;
		setSelectedProfileId(channelList[0]?.id ?? null);
	}, [channelList, selectedProfileId]);

	const reconnectTwitch = () => {
		authClient.signIn.social({
			provider: "twitch",
			callbackURL: appUrl("/moderation"),
			scopes: TWITCH_MODERATION_SCOPES,
		});
	};

	if (channels.isLoading) {
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
			<div
				style={{
					padding: "40px 40px 28px",
					borderBottom: "1px solid var(--gf-hl)",
					display: "flex",
					alignItems: "flex-end",
					gap: 24,
				}}
			>
				<div style={{ flex: 1 }}>
					<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
						Moderator tools
					</div>
					<h1
						className="gf-display"
						style={{
							fontSize: 52,
							color: "var(--gf-text)",
							margin: 0,
						}}
					>
						Allow GIFs
					</h1>
				</div>
				<div
					style={{
						fontFamily: "var(--gf-font-mono)",
						fontSize: 13,
						color: "var(--gf-muted)",
					}}
				>
					{channelList.length} channel{channelList.length === 1 ? "" : "s"}
				</div>
			</div>

			{channels.data?.needsReconnect ? (
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: 40,
					}}
				>
					<div style={{ maxWidth: 440, textAlign: "center" }}>
						<ShieldCheckIcon
							size={32}
							style={{ color: "var(--gf-accent)", marginBottom: 18 }}
						/>
						<h2
							className="gf-display"
							style={{
								fontSize: 32,
								color: "var(--gf-text)",
								marginBottom: 12,
							}}
						>
							Reconnect Twitch
						</h2>
						<p
							style={{
								fontSize: 14,
								color: "var(--gf-muted)",
								lineHeight: 1.55,
								marginBottom: 28,
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							Moderator access needs one extra Twitch permission so gifingie can
							see which enrolled channels you moderate.
						</p>
						<button
							type="button"
							className="gf-btn primary lg"
							onClick={reconnectTwitch}
						>
							<RefreshCwIcon size={15} />
							Reconnect
						</button>
					</div>
				</div>
			) : channelList.length === 0 ? (
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: 40,
					}}
				>
					<div style={{ maxWidth: 420, textAlign: "center" }}>
						<ShieldCheckIcon
							size={32}
							style={{ color: "var(--gf-muted)", marginBottom: 18 }}
						/>
						<h2
							className="gf-display"
							style={{
								fontSize: 30,
								color: "var(--gf-text)",
								marginBottom: 10,
							}}
						>
							No channels found
						</h2>
						<p
							style={{
								fontSize: 14,
								color: "var(--gf-muted)",
								lineHeight: 1.55,
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							You are not currently a Twitch moderator for any enrolled gifingie
							channels.
						</p>
					</div>
				</div>
			) : (
				<div
					style={{
						flex: 1,
						minHeight: 0,
						display: "grid",
						gridTemplateColumns: "280px 1fr",
					}}
				>
					<aside
						style={{
							borderRight: "1px solid var(--gf-hl)",
							padding: "22px 24px 24px 40px",
							overflowY: "auto",
						}}
					>
						<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
							Channels
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{channelList.map((channel) => {
								const selected = channel.id === selectedProfileId;
								return (
									<button
										key={channel.id}
										type="button"
										onClick={() => setSelectedProfileId(channel.id)}
										style={{
											border: "none",
											background: selected ? "var(--gf-t2)" : "transparent",
											color: "var(--gf-text)",
											padding: "10px 8px",
											borderRadius: 4,
											display: "flex",
											alignItems: "center",
											gap: 10,
											textAlign: "left",
											cursor: "pointer",
										}}
									>
										{channel.twitchAvatarUrl ? (
											<img
												src={channel.twitchAvatarUrl}
												alt=""
												style={{
													width: 28,
													height: 28,
													borderRadius: "50%",
													objectFit: "cover",
												}}
											/>
										) : (
											<span
												style={{
													width: 28,
													height: 28,
													borderRadius: "50%",
													background: "var(--gf-hl)",
													display: "inline-block",
												}}
											/>
										)}
										<span style={{ minWidth: 0 }}>
											<span
												style={{
													display: "block",
													fontFamily: "var(--gf-font-ui)",
													fontSize: 13,
													fontWeight: 500,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{channel.twitchDisplayName}
											</span>
											<span
												style={{
													display: "block",
													fontFamily: "var(--gf-font-mono)",
													fontSize: 11,
													color: "var(--gf-muted)",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{channel.twitchChannelLogin}
											</span>
										</span>
									</button>
								);
							})}
						</div>
					</aside>

					<main
						style={{
							padding: "22px 40px 24px 28px",
							minHeight: 0,
							overflowY: "auto",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								marginBottom: 12,
							}}
						>
							<div>
								<div className="gf-eyebrow">Pending approval</div>
								{selectedChannel ? (
									<div
										style={{
											fontFamily: "var(--gf-font-ui)",
											fontSize: 14,
											color: "var(--gf-muted)",
											marginTop: 5,
										}}
									>
										{selectedChannel.twitchDisplayName}
									</div>
								) : null}
							</div>
							<button
								type="button"
								className="gf-btn ghost sm"
								disabled={pending.isFetching}
								onClick={() => pending.refetch()}
							>
								<RefreshCwIcon size={13} />
								Refresh
							</button>
						</div>

						{pending.isLoading ? (
							<p
								style={{
									fontSize: 13,
									color: "var(--gf-muted)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								Loading pending GIFs…
							</p>
						) : pendingList.length === 0 ? (
							<p
								style={{
									fontSize: 13,
									color: "var(--gf-muted)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								Nothing is waiting for approval.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
								{pendingList.map((sub) => (
									<div
										key={sub.id}
										style={{
											display: "grid",
											gridTemplateColumns: "80px 1fr auto",
											gap: 14,
											alignItems: "center",
											padding: "12px 0",
											borderBottom: "1px solid var(--gf-hl)",
										}}
									>
										{sub.source === "sound" ? (
											<div
												style={{
													width: 80,
													height: 48,
													borderRadius: 3,
													background: "var(--gf-t2)",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													fontFamily: "var(--gf-font-mono)",
													fontSize: 10,
													color: "var(--gf-muted)",
												}}
											>
												SND
											</div>
										) : (
											<img
												src={sub.previewUrl ?? sub.gifUrl}
												alt={sub.title}
												style={{
													width: 80,
													height: 48,
													objectFit: "cover",
													borderRadius: 3,
												}}
											/>
										)}
										<div style={{ minWidth: 0 }}>
											<div
												style={{
													fontSize: 14,
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
												{sub.source === "upload"
													? "Custom upload"
													: sub.source === "sound"
														? "Sound"
														: "GIPHY"}
											</div>
											{sub.caption ? (
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: 8,
														marginTop: 4,
														minWidth: 0,
													}}
												>
													{sub.captionRequiresReview ? (
														<span
															style={{
																fontSize: 10,
																fontWeight: 600,
																letterSpacing: "0.04em",
																textTransform: "uppercase",
																color: "var(--gf-warn, #c9a227)",
																fontFamily: "var(--gf-font-mono)",
																flex: "0 0 auto",
															}}
														>
															Caption review
														</span>
													) : null}
													<div
														style={{
															fontSize: 12,
															color: "var(--gf-muted)",
															fontFamily: "var(--gf-font-ui)",
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
															minWidth: 0,
														}}
													>
														{sub.caption}
													</div>
												</div>
											) : null}
										</div>
										<div style={{ display: "flex", gap: 8 }}>
											<button
												type="button"
												className="gf-btn sm"
												style={{
													background: "var(--gf-ok)",
													color: "#fff",
													height: 30,
													padding: "0 10px",
												}}
												disabled={
													approve.isPending ||
													reject.isPending ||
													!selectedProfileId
												}
												onClick={() =>
													selectedProfileId &&
													approve.mutate({
														streamerProfileId: selectedProfileId,
														submissionId: sub.id,
													})
												}
											>
												<CheckIcon size={12} />
											</button>
											<button
												type="button"
												className="gf-btn sm outline"
												style={{ height: 30, padding: "0 10px" }}
												disabled={
													approve.isPending ||
													reject.isPending ||
													!selectedProfileId
												}
												onClick={() =>
													selectedProfileId &&
													reject.mutate({
														streamerProfileId: selectedProfileId,
														submissionId: sub.id,
													})
												}
											>
												<XIcon size={12} />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</main>
				</div>
			)}
		</div>
	);
}
