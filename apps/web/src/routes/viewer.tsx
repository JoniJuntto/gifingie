import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	RefreshCwIcon,
	SearchIcon,
	SendIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/viewer")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data || session.data.user.isAnonymous) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

// Colour helper for channel thumbnails
function channelHue(name: string) {
	return [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
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
				fontSize: size * 0.38,
				background: `linear-gradient(135deg, hsl(${hue} 60% 50%), hsl(${(hue + 40) % 360} 60% 40%))`,
			}}
		>
			{initials}
		</span>
	);
}

function ChannelThumb({
	name,
	thumbnailUrl,
	w = "100%",
	h = 190,
}: {
	name: string;
	thumbnailUrl?: string | null;
	w?: string | number;
	h?: number;
}) {
	const hue = channelHue(name);
	return (
		<div
			style={{
				width: w,
				height: h,
				position: "relative",
				borderRadius: 4,
				overflow: "hidden",
				background: `linear-gradient(135deg, hsl(${hue} 55% 28%), hsl(${(hue + 35) % 360} 50% 14%))`,
				flexShrink: 0,
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
					backgroundSize: "32px 32px",
					opacity: 0.5,
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "rgba(255,255,255,0.20)",
					fontFamily: "var(--gf-font-mono)",
					fontSize: 11,
					letterSpacing: "0.2em",
					textTransform: "uppercase",
				}}
			>
				{name}
			</div>
			{thumbnailUrl && (
				<img
					src={thumbnailUrl}
					alt=""
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "cover",
						display: "block",
					}}
					onError={(event) => {
						event.currentTarget.style.display = "none";
					}}
				/>
			)}
			{/* Live dot */}
			<span
				style={{
					position: "absolute",
					top: 12,
					left: 12,
					color: "#fff",
					fontSize: 10,
					fontWeight: 600,
					letterSpacing: "0.12em",
					textTransform: "uppercase",
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					fontFamily: "var(--gf-font-ui)",
				}}
			>
				<span className="gf-dot live" style={{ width: 6, height: 6 }} />
				Live
			</span>
		</div>
	);
}

function GifTile({
	url,
	title,
	selected,
	onClick,
}: {
	url: string;
	title: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				display: "block",
				width: "100%",
				position: "relative",
				borderRadius: 4,
				overflow: "hidden",
				cursor: "pointer",
				outline: selected
					? "2px solid var(--gf-accent)"
					: "0 solid transparent",
				outlineOffset: 2,
				transition: "outline 0.12s",
				border: "none",
				padding: 0,
				background: "transparent",
			}}
		>
			<img
				src={url}
				alt={title}
				style={{ width: "100%", height: "auto", display: "block" }}
			/>
		</button>
	);
}

export type Streamer = {
	id: string;
	twitchDisplayName: string;
	twitchChannelLogin: string;
	twitchAvatarUrl?: string | null;
	streamTitle?: string | null;
	streamThumbnailUrl?: string | null;
};

type GifResult = {
	id: string;
	title: string;
	gifUrl: string;
	previewUrl?: string | null;
};

type CustomUploadResult = {
	id: number;
	title: string;
	gifUrl: string;
	previewUrl?: string | null;
	contentType?: string | null;
	originalFilename?: string | null;
};

type SelectedImage =
	| (GifResult & { source: "giphy" })
	| (CustomUploadResult & { source: "upload" });

const PICKER_SKELETON_KEYS = ["one", "two", "three", "four", "five", "six"];

// ─── Picker screen ────────────────────────────────────────────────────────────
function PickerScreen({
	streamers,
	isLoading,
	onRefresh,
	onSelect,
}: {
	streamers: Streamer[];
	isLoading: boolean;
	onRefresh: () => void;
	onSelect: (id: string) => void;
}) {
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
					padding: "48px 40px 28px",
					display: "grid",
					gridTemplateColumns: "1fr auto",
					alignItems: "flex-end",
					gap: 24,
					flexShrink: 0,
				}}
			>
				<div>
					<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
						Step 01 / Pick a streamer
					</div>
					<h1
						className="gf-display"
						style={{ fontSize: 52, color: "var(--gf-text)" }}
					>
						Live <span style={{ color: "var(--gf-muted-2)" }}>now</span>.
					</h1>
				</div>
				{!isLoading && (
					<div style={{ textAlign: "right" }}>
						<div
							style={{
								fontFamily: "var(--gf-font-mono)",
								fontSize: 32,
								fontWeight: 300,
								letterSpacing: "-0.04em",
								color: "var(--gf-text)",
							}}
						>
							{streamers.length}
						</div>
						<div
							style={{
								fontSize: 12,
								color: "var(--gf-muted)",
								marginTop: 2,
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							streamers
						</div>
					</div>
				)}
			</div>

			{/* Tab / refresh row */}
			<div
				style={{
					borderBottom: "1px solid var(--gf-hl)",
					padding: "0 40px",
					display: "flex",
					alignItems: "center",
					flexShrink: 0,
				}}
			>
				<span
					style={{
						padding: "14px 0",
						fontSize: 14,
						fontWeight: 500,
						color: "var(--gf-text)",
						borderBottom: "2px solid var(--gf-text)",
						marginBottom: -1,
						letterSpacing: "-0.01em",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					All live
					<span
						style={{
							fontFamily: "var(--gf-font-mono)",
							fontSize: 11,
							color: "var(--gf-muted-2)",
							marginLeft: 8,
						}}
					>
						{streamers.length}
					</span>
				</span>
				<button
					type="button"
					className="gf-btn ghost"
					style={{ marginLeft: "auto", fontSize: 13 }}
					onClick={onRefresh}
				>
					<RefreshCwIcon size={13} />
					Refresh
				</button>
			</div>

			{/* Grid */}
			<div
				style={{
					padding: "28px 40px 40px",
					flex: 1,
					overflowY: "auto",
				}}
			>
				{isLoading && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
							gap: "36px 32px",
						}}
					>
						{PICKER_SKELETON_KEYS.map((key) => (
							<div
								key={key}
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 12,
								}}
							>
								<div
									style={{
										aspectRatio: "16/9",
										borderRadius: 4,
										background: "var(--gf-t2)",
									}}
								/>
								<div
									style={{
										height: 14,
										width: "60%",
										borderRadius: 2,
										background: "var(--gf-t2)",
									}}
								/>
							</div>
						))}
					</div>
				)}

				{!isLoading && streamers.length === 0 && (
					<div
						style={{
							padding: "60px 0",
							textAlign: "center",
							color: "var(--gf-muted)",
							fontSize: 14,
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						No enrolled streamers are live right now.
					</div>
				)}

				{!isLoading && streamers.length > 0 && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
							gap: "36px 32px",
						}}
					>
						{streamers.map((s) => (
							<button
								key={s.id}
								type="button"
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 12,
									cursor: "pointer",
									background: "transparent",
									border: "none",
									padding: 0,
									textAlign: "left",
								}}
								onClick={() => onSelect(s.id)}
							>
								<ChannelThumb
									name={s.twitchChannelLogin ?? s.twitchDisplayName}
									thumbnailUrl={s.streamThumbnailUrl}
								/>
								<div
									style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
								>
									<Avatar name={s.twitchDisplayName} size={30} />
									<div style={{ flex: 1, minWidth: 0 }}>
										<div
											style={{
												fontSize: 15,
												fontWeight: 500,
												letterSpacing: "-0.02em",
												color: "var(--gf-text)",
												fontFamily: "var(--gf-font-ui)",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{s.twitchDisplayName}
										</div>
										<div
											style={{
												fontSize: 12,
												color: "var(--gf-muted)",
												marginTop: 2,
												fontFamily: "var(--gf-font-mono)",
												letterSpacing: "-0.01em",
											}}
										>
											@{s.twitchChannelLogin}
										</div>
										{s.streamTitle && (
											<div
												style={{
													fontSize: 13,
													color: "var(--gf-muted-2)",
													marginTop: 8,
													fontFamily: "var(--gf-font-ui)",
													lineHeight: 1.35,
													display: "-webkit-box",
													WebkitLineClamp: 2,
													WebkitBoxOrient: "vertical",
													overflow: "hidden",
												}}
											>
												{s.streamTitle}
											</div>
										)}
									</div>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Search / submit screen ───────────────────────────────────────────────────
export function SearchScreen({
	streamer,
	onBack,
}: {
	streamer: Streamer;
	onBack: () => void;
}) {
	const [query, setQuery] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<"giphy" | "custom">("giphy");
	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		null,
	);
	const [caption, setCaption] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const { data: session } = authClient.useSession();
	const [sessionStatus, setSessionStatus] = useState<
		"checking" | "ready" | "failed"
	>("checking");

	useEffect(() => {
		let cancelled = false;

		async function ensureSession() {
			setSessionStatus("checking");
			const existingSession = await authClient.getSession();
			if (cancelled) return;

			if (existingSession.data) {
				setSessionStatus("ready");
				return;
			}

			const anonymousSession = await authClient.signIn.anonymous();
			if (cancelled) return;

			if (anonymousSession.error) {
				setSessionStatus("failed");
				toast.error(
					anonymousSession.error.message ??
						"Could not start an anonymous session.",
				);
				return;
			}

			setSessionStatus("ready");
		}

		ensureSession().catch((error) => {
			if (cancelled) return;
			setSessionStatus("failed");
			toast.error(
				error instanceof Error
					? error.message
					: "Could not start an anonymous session.",
			);
		});

		return () => {
			cancelled = true;
		};
	}, []);

	// ⌘K / Ctrl+K focuses the search input
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				searchRef.current?.focus();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const canUseGiphy = sessionStatus === "ready";
	const canUseCustomUploads = Boolean(session && !session.user.isAnonymous);

	const giphy = useQuery({
		...trpc.giphy.search.queryOptions({ query: searchQuery }),
		enabled: canUseGiphy && searchQuery.length >= 2,
	});

	const customUploads = useQuery({
		...trpc.gifs.listCustomUploads.queryOptions({
			streamerProfileId: streamer.id,
		}),
		enabled: canUseCustomUploads,
	});

	const submit = useMutation(
		trpc.gifs.submit.mutationOptions({
			onSuccess: async (submission) => {
				toast.success(
					submission.moderationStatus === "pending"
						? "Sent for approval"
						: "GIF sent to overlay",
				);
				setSelectedImage(null);
				setCaption("");
				await queryClient.invalidateQueries();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const resendCustomUpload = useMutation(
		trpc.gifs.resendCustomUpload.mutationOptions({
			onSuccess: async () => {
				toast.success("Custom image sent to overlay");
				setSelectedImage(null);
				setCaption("");
				await queryClient.invalidateQueries();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const upload = useMutation({
		mutationFn: async (file: File) => {
			const uploadRequest = await trpcClient.gifs.createUpload.mutate({
				streamerProfileId: streamer.id,
				contentType: file.type,
				byteSize: file.size,
				originalFilename: file.name,
			});
			const uploadResponse = await fetch(uploadRequest.uploadUrl, {
				method: "PUT",
				headers: uploadRequest.headers,
				body: file,
			});
			if (!uploadResponse.ok) throw new Error("Upload to storage failed.");
			return trpcClient.gifs.completeUpload.mutate({
				submissionId: uploadRequest.submissionId,
			});
		},
		onSuccess: async () => {
			if (fileRef.current) fileRef.current.value = "";
			toast.success("Sent for approval");
			await queryClient.invalidateQueries();
		},
		onError: (error) => toast.error(error.message),
	});

	const gifs: GifResult[] = giphy.data ?? [];
	const uploads: CustomUploadResult[] = customUploads.data ?? [];
	const isSending = submit.isPending || resendCustomUpload.isPending;

	function selectTab(tab: "giphy" | "custom") {
		setActiveTab(tab);
		setSelectedImage(null);
		setCaption("");
	}

	const handleSend = useCallback(() => {
		if (!selectedImage) return;
		if (selectedImage.source === "giphy") {
			if (!canUseGiphy) {
				toast.error("Anonymous access is still starting.");
				return;
			}
			submit.mutate({
				streamerProfileId: streamer.id,
				caption,
				gif: {
					id: selectedImage.id,
					title: selectedImage.title,
					gifUrl: selectedImage.gifUrl,
					previewUrl: selectedImage.previewUrl ?? undefined,
				},
			});
			return;
		}
		if (!canUseCustomUploads) {
			toast.error("Sign in with Twitch to use custom uploads.");
			return;
		}
		resendCustomUpload.mutate({
			streamerProfileId: streamer.id,
			submissionId: selectedImage.id,
			caption,
		});
	}, [
		selectedImage,
		canUseGiphy,
		canUseCustomUploads,
		submit,
		resendCustomUpload,
		streamer.id,
		caption,
	]);

	return (
		<div
			className="gf-page"
			style={{
				position: "relative",
				height: "100%",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* ── Top header ── */}
			<div style={{ padding: "28px 56px 0", flexShrink: 0 }}>
				{/* Row 1: back · eyebrow · target pill */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 14,
						marginBottom: 32,
					}}
				>
					<button
						type="button"
						className="gf-btn ghost"
						onClick={onBack}
						style={{ fontSize: 13, gap: 6 }}
					>
						<ArrowLeftIcon size={14} />
						Back
					</button>
					<span style={{ color: "var(--gf-muted-2)" }}>·</span>
					<div className="gf-eyebrow">Send a GIF</div>

					{/* Target pill */}
					<div
						style={{
							marginLeft: "auto",
							display: "flex",
							alignItems: "center",
							gap: 9,
							padding: "5px 12px 5px 6px",
							border: "1px solid var(--gf-hl)",
							borderRadius: 999,
						}}
					>
						<Avatar name={streamer.twitchDisplayName} size={22} />
						<span
							style={{
								fontSize: 13,
								color: "var(--gf-muted)",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							to
						</span>
						<span
							style={{
								fontSize: 14,
								fontWeight: 500,
								letterSpacing: "-0.02em",
								color: "var(--gf-text)",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							{streamer.twitchDisplayName}
						</span>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 5,
								paddingLeft: 10,
								marginLeft: 2,
								borderLeft: "1px solid var(--gf-hl)",
								fontSize: 10,
								fontWeight: 600,
								letterSpacing: "0.14em",
								textTransform: "uppercase",
								color: "var(--gf-live)",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							<span
								className="gf-dot live"
								style={{ width: 6, height: 6 }}
							/>
							Live
						</span>
					</div>
				</div>

				{/* Row 2: tabs */}
				<div
					style={{
						display: "flex",
						gap: 28,
						borderBottom: "1px solid var(--gf-hl)",
					}}
				>
					{(
						[
							["giphy", "GIPHY", null],
							["custom", "Custom uploads", uploads.length],
						] as const
					).map(([tab, label, count]) => (
						<button
							key={tab}
							type="button"
							className="gf-btn ghost"
							style={{
								padding: "14px 0",
								fontSize: 14,
								fontWeight: 500,
								color:
									activeTab === tab ? "var(--gf-text)" : "var(--gf-muted)",
								borderBottom:
									activeTab === tab
										? "2px solid var(--gf-text)"
										: "2px solid transparent",
								marginBottom: -1,
								letterSpacing: "-0.01em",
								gap: 7,
							}}
							onClick={() => selectTab(tab)}
						>
							{label}
							{count !== null && (
								<span
									style={{
										fontFamily: "var(--gf-font-mono)",
										fontSize: 11,
										color: "var(--gf-muted-2)",
									}}
								>
									{count}
								</span>
							)}
						</button>
					))}
					{activeTab === "custom" && (
						<button
							type="button"
							className="gf-btn ghost"
							style={{ marginLeft: "auto", fontSize: 13 }}
							disabled={!canUseCustomUploads || customUploads.isFetching}
							onClick={() => customUploads.refetch()}
						>
							<RefreshCwIcon size={13} />
							Refresh
						</button>
					)}
				</div>

				{/* Row 3 (GIPHY only): hero search input */}
				{activeTab === "giphy" && (
					<>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								setSearchQuery(query.trim());
							}}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 20,
								paddingBottom: 14,
								borderBottom: "1.5px solid var(--gf-text)",
								marginTop: 24,
							}}
						>
							<SearchIcon
								size={26}
								color="var(--gf-text)"
								strokeWidth={1.4}
								style={{ flexShrink: 0 }}
							/>
							<input
								ref={searchRef}
								className="gf-input"
								style={{
									borderBottom: 0,
									padding: 0,
									fontSize: 44,
									fontWeight: 300,
									letterSpacing: "-0.035em",
									height: 64,
									lineHeight: 1,
									fontFamily: "var(--gf-font-ui)",
								}}
								placeholder="What's the vibe?"
								value={query}
								disabled={!canUseGiphy}
								onChange={(e) => setQuery(e.target.value)}
							/>
							<span
								style={{
									fontFamily: "var(--gf-font-mono)",
									fontSize: 11,
									color: "var(--gf-muted-2)",
									letterSpacing: "0.04em",
									flex: "0 0 auto",
								}}
							>
								⌘ K
							</span>
						</form>

						{sessionStatus === "failed" && (
							<p
								style={{
									margin: "10px 0 0",
									fontSize: 13,
									color: "var(--gf-live)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								Anonymous access could not be started. Refresh and try again.
							</p>
						)}

						{/* Trending tags + upload-your-own */}
						<div
							style={{
								marginTop: 14,
								marginBottom: 2,
								display: "flex",
								alignItems: "center",
								gap: 22,
								fontSize: 13,
								color: "var(--gf-muted)",
								fontFamily: "var(--gf-font-ui)",
							}}
						>
							<span
								style={{ color: "var(--gf-text)", fontWeight: 500 }}
							>
								Trending
							</span>
							{["Pog", "GG", "Hype", "Sad", "Cute", "Cats"].map((t) => (
								<button
									key={t}
									type="button"
									className="gf-btn ghost"
									style={{ fontSize: 13 }}
									disabled={!canUseGiphy}
									onClick={() => {
										setQuery(t);
										setSearchQuery(t);
									}}
								>
									{t}
								</button>
							))}
							<span
								style={{
									marginLeft: "auto",
									display: "inline-flex",
									alignItems: "center",
									gap: 18,
								}}
							>
								<label
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: 7,
										color: "var(--gf-text)",
										cursor:
											canUseCustomUploads && !upload.isPending
												? "pointer"
												: "default",
										fontSize: 13,
										opacity:
											canUseCustomUploads && !upload.isPending ? 1 : 0.45,
									}}
									title={
										!canUseCustomUploads
											? "Sign in with Twitch to upload"
											: undefined
									}
								>
									<UploadIcon size={13} />
									{upload.isPending ? "Uploading…" : "Upload your own"}
									<input
										ref={fileRef}
										type="file"
										accept="image/jpeg,image/png,image/webp,image/gif"
										style={{ display: "none" }}
										disabled={!canUseCustomUploads || upload.isPending}
										onChange={(e) => {
											const file = e.target.files?.[0] ?? null;
											if (!file) return;
											if (file.size > 10 * 1024 * 1024) {
												toast.error("Upload must be 10 MB or smaller.");
												e.currentTarget.value = "";
												return;
											}
											upload.mutate(file);
										}}
									/>
								</label>
								<span
									style={{
										fontSize: 11,
										color: "var(--gf-muted-2)",
										fontFamily: "var(--gf-font-mono)",
										letterSpacing: "0.04em",
									}}
								>
									Powered by GIPHY
								</span>
							</span>
						</div>
					</>
				)}

				{/* Custom tab description */}
				{activeTab === "custom" && (
					<div
						style={{
							paddingTop: 16,
							paddingBottom: 4,
							fontSize: 13,
							color: "var(--gf-muted)",
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						{canUseCustomUploads
							? "Approved custom images for this channel — click to send again."
							: "Sign in with Twitch to browse and send custom uploads."}
					</div>
				)}
			</div>

			{/* ── Masonry grid ── */}
			<div
				style={{
					padding: "28px 56px 140px",
					flex: 1,
					overflowY: "auto",
				}}
			>
				{/* GIPHY results */}
				{activeTab === "giphy" && (
					<>
						{giphy.isFetching && (
							<div
								style={{ columnCount: 4, columnGap: 14 }}
							>
								{PICKER_SKELETON_KEYS.map((key) => (
									<div
										key={key}
										style={{ breakInside: "avoid", marginBottom: 14 }}
									>
										<div
											style={{
												aspectRatio: "16/9",
												borderRadius: 4,
												background: "var(--gf-t2)",
											}}
										/>
									</div>
								))}
							</div>
						)}

						{!giphy.isFetching && gifs.length > 0 && (
							<div style={{ columnCount: 4, columnGap: 14 }}>
								{gifs.map((gif) => (
									<div
										key={gif.id}
										style={{ breakInside: "avoid", marginBottom: 14 }}
									>
										<GifTile
											url={gif.previewUrl ?? gif.gifUrl}
											title={gif.title}
											selected={
												selectedImage?.source === "giphy" &&
												selectedImage.id === gif.id
											}
											onClick={() =>
												setSelectedImage(
													selectedImage?.source === "giphy" &&
														selectedImage.id === gif.id
														? null
														: { ...gif, source: "giphy" },
												)
											}
										/>
									</div>
								))}
							</div>
						)}

						{!giphy.isFetching &&
							searchQuery.length >= 2 &&
							gifs.length === 0 && (
								<p
									style={{
										color: "var(--gf-muted)",
										fontSize: 14,
										fontFamily: "var(--gf-font-ui)",
									}}
								>
									No GIFs found for &ldquo;{searchQuery}&rdquo;.
								</p>
							)}

						{!searchQuery && !giphy.isFetching && (
							<p
								style={{
									color: "var(--gf-muted-2)",
									fontSize: 14,
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								Type above to search, or pick a trending tag.
							</p>
						)}
					</>
				)}

				{/* Custom uploads */}
				{activeTab === "custom" && (
					<>
						{!canUseCustomUploads && (
							<p
								style={{
									color: "var(--gf-muted)",
									fontSize: 14,
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								Sign in with Twitch to browse and send custom uploads.
							</p>
						)}

						{canUseCustomUploads && customUploads.isLoading && (
							<div style={{ columnCount: 4, columnGap: 14 }}>
								{PICKER_SKELETON_KEYS.map((key) => (
									<div
										key={key}
										style={{ breakInside: "avoid", marginBottom: 14 }}
									>
										<div
											style={{
												aspectRatio: "16/9",
												borderRadius: 4,
												background: "var(--gf-t2)",
											}}
										/>
									</div>
								))}
							</div>
						)}

						{canUseCustomUploads &&
							!customUploads.isLoading &&
							uploads.length > 0 && (
								<div style={{ columnCount: 4, columnGap: 14 }}>
									{uploads.map((u) => (
										<div
											key={u.id}
											style={{ breakInside: "avoid", marginBottom: 14 }}
										>
											<GifTile
												url={u.previewUrl ?? u.gifUrl}
												title={u.title}
												selected={
													selectedImage?.source === "upload" &&
													selectedImage.id === u.id
												}
												onClick={() =>
													setSelectedImage(
														selectedImage?.source === "upload" &&
															selectedImage.id === u.id
															? null
															: { ...u, source: "upload" },
													)
												}
											/>
										</div>
									))}
								</div>
							)}

						{canUseCustomUploads &&
							!customUploads.isLoading &&
							uploads.length === 0 && (
								<p
									style={{
										color: "var(--gf-muted)",
										fontSize: 14,
										fontFamily: "var(--gf-font-ui)",
									}}
								>
									No approved custom uploads for this channel yet.
								</p>
							)}
					</>
				)}
			</div>

			{/* ── Floating dock (appears on selection) ── */}
			{selectedImage && (
				<div
					style={{
						position: "absolute",
						left: 56,
						right: 56,
						bottom: 28,
						background: "var(--gf-inv)",
						color: "var(--gf-on-inv)",
						borderRadius: 14,
						padding: "12px 12px 12px 14px",
						display: "flex",
						alignItems: "center",
						gap: 18,
						boxShadow:
							"0 18px 50px -20px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.18)",
					}}
				>
					{/* Mini preview */}
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 8,
							overflow: "hidden",
							flex: "0 0 auto",
						}}
					>
						<img
							src={selectedImage.previewUrl ?? selectedImage.gifUrl}
							alt={selectedImage.title}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								display: "block",
							}}
						/>
					</div>

					{/* Title + meta */}
					<div style={{ flex: "0 0 auto", minWidth: 120 }}>
						<div
							style={{
								fontSize: 14,
								fontWeight: 500,
								letterSpacing: "-0.02em",
								color: "var(--gf-on-inv)",
								fontFamily: "var(--gf-font-ui)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								maxWidth: 200,
							}}
						>
							{selectedImage.title}
						</div>
						<div
							style={{
								fontSize: 11,
								color: "rgba(255,255,255,0.5)",
								fontFamily: "var(--gf-font-mono)",
								marginTop: 2,
								letterSpacing: "0.02em",
							}}
						>
							{selectedImage.source === "giphy" ? "giphy" : "custom"} ·{" "}
							{String(selectedImage.id).slice(0, 12)}
						</div>
					</div>

					<span
						style={{
							width: 1,
							height: 28,
							background: "rgba(255,255,255,0.14)",
							flex: "0 0 auto",
						}}
					/>

					{/* Caption */}
					<input
						value={caption}
						maxLength={120}
						placeholder="Add a caption (optional)"
						style={{
							flex: 1,
							minWidth: 0,
							background: "transparent",
							border: 0,
							outline: "none",
							fontSize: 15,
							color: "var(--gf-on-inv)",
							fontFamily: "var(--gf-font-ui)",
							letterSpacing: "-0.01em",
							padding: "8px 4px",
						}}
						onChange={(e) => setCaption(e.target.value)}
					/>

					{/* Send */}
					<button
						type="button"
						className="gf-btn primary"
						style={{
							height: 44,
							padding: "0 18px",
							fontSize: 14,
							flex: "0 0 auto",
							borderRadius: 8,
						}}
						disabled={
							isSending ||
							(selectedImage.source === "giphy" && !canUseGiphy) ||
							(selectedImage.source === "upload" && !canUseCustomUploads)
						}
						onClick={handleSend}
					>
						{isSending ? "Sending…" : "Send"}
						<SendIcon size={14} />
					</button>

					{/* Dismiss */}
					<button
						type="button"
						onClick={() => setSelectedImage(null)}
						style={{
							height: 44,
							width: 44,
							padding: 0,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							background: "transparent",
							border: "none",
							cursor: "pointer",
							color: "rgba(255,255,255,0.5)",
							flex: "0 0 auto",
							borderRadius: 6,
						}}
					>
						<XIcon size={15} />
					</button>
				</div>
			)}
		</div>
	);
}

// ─── Route component ──────────────────────────────────────────────────────────
function RouteComponent() {
	const [selectedStreamerId, setSelectedStreamerId] = useState<string | null>(
		null,
	);
	const liveStreamers = useQuery(trpc.streamers.listLive.queryOptions());

	const selectedStreamer =
		liveStreamers.data?.find((s) => s.id === selectedStreamerId) ?? null;

	if (selectedStreamer) {
		return (
			<SearchScreen
				streamer={selectedStreamer}
				onBack={() => setSelectedStreamerId(null)}
			/>
		);
	}

	return (
		<PickerScreen
			streamers={liveStreamers.data ?? []}
			isLoading={liveStreamers.isLoading}
			onRefresh={() => liveStreamers.refetch()}
			onSelect={setSelectedStreamerId}
		/>
	);
}
