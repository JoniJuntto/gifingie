import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	RefreshCwIcon,
	SearchIcon,
	SendIcon,
	UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/viewer")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
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
				position: "relative",
				borderRadius: 4,
				overflow: "hidden",
				cursor: "pointer",
				aspectRatio: "16/9",
				outline: selected
					? "2px solid var(--gf-accent)"
					: "0 solid transparent",
				outlineOffset: 2,
				transition: "transform 0.12s, outline 0.12s",
				border: "none",
				padding: 0,
				background: "transparent",
			}}
		>
			<img
				src={url}
				alt={title}
				style={{
					width: "100%",
					height: "100%",
					objectFit: "cover",
					display: "block",
				}}
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
	const [selectedGif, setSelectedGif] = useState<GifResult | null>(null);
	const [caption, setCaption] = useState("");
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const giphy = useQuery({
		...trpc.giphy.search.queryOptions({ query: searchQuery }),
		enabled: searchQuery.length >= 2,
	});

	const submit = useMutation(
		trpc.gifs.submit.mutationOptions({
			onSuccess: async (submission) => {
				toast.success(
					submission.moderationStatus === "pending"
						? "Sent for approval"
						: "GIF sent to overlay",
				);
				setSelectedGif(null);
				setCaption("");
				await queryClient.invalidateQueries();
			},
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
			setUploadFile(null);
			if (fileRef.current) fileRef.current.value = "";
			toast.success("Sent for approval");
			await queryClient.invalidateQueries();
		},
		onError: (error) => toast.error(error.message),
	});

	const gifs: GifResult[] = giphy.data ?? [];

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
			{/* Breadcrumb row */}
			<div
				style={{
					padding: "28px 40px 24px",
					display: "flex",
					alignItems: "center",
					gap: 14,
					flexShrink: 0,
				}}
			>
				<button
					type="button"
					className="gf-btn ghost"
					onClick={onBack}
					style={{ fontSize: 13 }}
				>
					<ArrowLeftIcon size={14} />
					Back
				</button>
				<span style={{ color: "var(--gf-muted-2)" }}>/</span>
				<div className="gf-eyebrow">Step 02 / Send a GIF</div>
				<div
					style={{
						marginLeft: "auto",
						display: "flex",
						alignItems: "center",
						gap: 12,
					}}
				>
					<span
						style={{
							fontSize: 13,
							color: "var(--gf-muted)",
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						To
					</span>
					<Avatar name={streamer.twitchDisplayName} size={24} />
					<span
						style={{
							fontSize: 15,
							fontWeight: 500,
							letterSpacing: "-0.02em",
							fontFamily: "var(--gf-font-ui)",
							color: "var(--gf-text)",
						}}
					>
						{streamer.twitchDisplayName}
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "var(--gf-live)",
							fontFamily: "var(--gf-font-ui)",
						}}
					>
						<span className="gf-dot live" />
						Live
					</span>
				</div>
			</div>

			{/* Search input */}
			<div style={{ padding: "0 40px 20px", flexShrink: 0 }}>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						setSearchQuery(query.trim());
					}}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 16,
						borderBottom: "1px solid var(--gf-text)",
					}}
				>
					<SearchIcon
						size={20}
						color="var(--gf-text)"
						style={{ flexShrink: 0 }}
					/>
					<input
						className="gf-input"
						style={{
							borderBottom: 0,
							fontSize: 28,
							fontWeight: 300,
							letterSpacing: "-0.03em",
							height: 56,
							fontFamily: "var(--gf-font-ui)",
						}}
						placeholder="Search GIFs…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<button
						type="submit"
						className="gf-btn sm"
						style={{ flexShrink: 0 }}
						disabled={query.trim().length < 2 || giphy.isFetching}
					>
						{giphy.isFetching ? "Searching…" : "Search"}
					</button>
				</form>
				<div
					style={{
						marginTop: 12,
						display: "flex",
						alignItems: "center",
						gap: 20,
						fontSize: 13,
						color: "var(--gf-muted)",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					<span style={{ color: "var(--gf-text)", fontWeight: 500 }}>
						Trending
					</span>
					{["Pog", "GG", "Hype", "Sad", "Cute", "Cats"].map((t) => (
						<button
							key={t}
							type="button"
							className="gf-btn ghost"
							style={{ fontSize: 13 }}
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
							fontSize: 11,
							color: "var(--gf-muted)",
							fontFamily: "var(--gf-font-mono)",
							letterSpacing: "0.04em",
						}}
					>
						Search powered by GIPHY
					</span>
				</div>
			</div>

			{/* Body: gif grid + selection rail */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 360px",
					flex: 1,
					minHeight: 0,
					borderTop: "1px solid var(--gf-hl)",
				}}
			>
				{/* GIF grid */}
				<div
					style={{
						padding: "20px 28px 20px 40px",
						overflowY: "auto",
					}}
				>
					{/* Upload section */}
					<div style={{ marginBottom: 20 }}>
						<div className="gf-eyebrow" style={{ marginBottom: 10 }}>
							Custom upload
						</div>
						<form
							style={{ display: "flex", gap: 12, alignItems: "center" }}
							onSubmit={(e) => {
								e.preventDefault();
								if (!uploadFile) return toast.error("Choose a file first.");
								upload.mutate(uploadFile);
							}}
						>
							<label
								style={{
									flex: 1,
									height: 36,
									border: "1px solid var(--gf-hl2)",
									borderRadius: 4,
									display: "flex",
									alignItems: "center",
									gap: 10,
									padding: "0 12px",
									cursor: "pointer",
									fontSize: 13,
									color: "var(--gf-muted)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								<UploadIcon size={13} />
								<input
									ref={fileRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif"
									style={{ minWidth: 0, flex: 1, fontSize: 13 }}
									disabled={upload.isPending}
									onChange={(e) => {
										const file = e.target.files?.[0] ?? null;
										if (file && file.size > 10 * 1024 * 1024) {
											toast.error("Upload must be 10 MB or smaller.");
											e.currentTarget.value = "";
											return setUploadFile(null);
										}
										setUploadFile(file);
									}}
								/>
							</label>
							<button
								type="submit"
								className="gf-btn sm primary"
								disabled={!uploadFile || upload.isPending}
							>
								{upload.isPending ? "Uploading…" : "Send for approval"}
							</button>
						</form>
					</div>

					<div className="gf-eyebrow" style={{ marginBottom: 12 }}>
						{searchQuery
							? `Results for "${searchQuery}"`
							: "Search above to find GIFs"}
					</div>

					{gifs.length > 0 && (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(4, 1fr)",
								gap: 10,
							}}
						>
							{gifs.map((gif) => (
								<GifTile
									key={gif.id}
									url={gif.previewUrl ?? gif.gifUrl}
									title={gif.title}
									selected={selectedGif?.id === gif.id}
									onClick={() =>
										setSelectedGif(selectedGif?.id === gif.id ? null : gif)
									}
								/>
							))}
						</div>
					)}

					{searchQuery.length >= 2 &&
						!giphy.isFetching &&
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
				</div>

				{/* Selection rail */}
				<aside
					style={{
						borderLeft: "1px solid var(--gf-hl)",
						padding: "20px 40px 24px 28px",
						display: "flex",
						flexDirection: "column",
						gap: 18,
						overflowY: "auto",
					}}
				>
					<div className="gf-eyebrow">Selected</div>

					{selectedGif ? (
						<>
							<img
								src={selectedGif.previewUrl ?? selectedGif.gifUrl}
								alt={selectedGif.title}
								style={{
									width: "100%",
									aspectRatio: "16/9",
									objectFit: "cover",
									borderRadius: 4,
								}}
							/>

							<h3
								style={{
									fontSize: 20,
									fontWeight: 500,
									letterSpacing: "-0.03em",
									margin: 0,
									color: "var(--gf-text)",
									fontFamily: "var(--gf-font-ui)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{selectedGif.title}
							</h3>

							{/* Spec rows */}
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									fontSize: 12,
									color: "var(--gf-muted)",
									fontFamily: "var(--gf-font-ui)",
								}}
							>
								{[
									["Source", "GIPHY"],
									["GIF id", selectedGif.id.slice(0, 14)],
								].map(([k, v]) => (
									<div
										key={k}
										style={{
											display: "flex",
											justifyContent: "space-between",
											padding: "9px 0",
											borderBottom: "1px solid var(--gf-hl)",
										}}
									>
										<span>{k}</span>
										<span
											style={{
												color: "var(--gf-text)",
												fontFamily: "var(--gf-font-mono)",
											}}
										>
											{v}
										</span>
									</div>
								))}
							</div>

							{/* Caption */}
							<div>
								<div className="gf-eyebrow" style={{ marginBottom: 8 }}>
									Caption (optional)
								</div>
								<input
									className="gf-input"
									placeholder="Add a message…"
									value={caption}
									maxLength={120}
									style={{ fontSize: 14 }}
									onChange={(e) => setCaption(e.target.value)}
								/>
							</div>

							<button
								type="button"
								className="gf-btn primary lg block"
								style={{ marginTop: "auto" }}
								disabled={submit.isPending}
								onClick={() =>
									submit.mutate({
										streamerProfileId: streamer.id,
										caption,
										gif: {
											...selectedGif,
											previewUrl: selectedGif.previewUrl ?? undefined,
										},
									})
								}
							>
								{submit.isPending
									? "Sending…"
									: `Send to ${streamer.twitchDisplayName}`}
								<SendIcon size={14} />
							</button>
						</>
					) : (
						<p
							style={{
								fontSize: 14,
								color: "var(--gf-muted)",
								fontFamily: "var(--gf-font-ui)",
								lineHeight: 1.55,
							}}
						>
							Click a GIF in the results to select it, then send it to the
							stream.
						</p>
					)}
				</aside>
			</div>
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
