import { useEffect, useState } from "react";
import { type Submission, fetchSubmissions } from "../lib/api";
import { StatusMessage } from "./StatusMessage";

type Props = {
	token: string;
};

const STATUS_LABEL: Record<Submission["moderationStatus"], string> = {
	pending: "Pending",
	approved: "Approved",
	rejected: "Rejected",
};

const STATUS_COLOR: Record<Submission["moderationStatus"], string> = {
	pending: "var(--gf-muted)",
	approved: "var(--gf-ok)",
	rejected: "var(--gf-live)",
};

export function HistoryView({ token }: Props) {
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		fetchSubmissions(token)
			.then((r) => setSubmissions(r.submissions))
			.catch(() => setError(true))
			.finally(() => setLoading(false));
	}, [token]);

	if (loading) return <StatusMessage>Loading…</StatusMessage>;
	if (error) return <StatusMessage variant="error">Failed to load history</StatusMessage>;
	if (submissions.length === 0) {
		return <StatusMessage>No submissions yet — send your first GIF!</StatusMessage>;
	}

	return (
		<div style={{ overflowY: "auto", padding: "8px 0" }}>
			{submissions.map((sub) => (
				<div
					key={sub.id}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "8px 16px",
						borderBottom: "1px solid var(--gf-hl)",
					}}
				>
					{(sub.previewUrl ?? sub.gifUrl) ? (
						<img
							src={sub.previewUrl ?? sub.gifUrl ?? ""}
							alt={sub.title}
							style={{
								width: 48,
								height: 48,
								objectFit: "cover",
								borderRadius: 4,
								flexShrink: 0,
								background: "var(--gf-bg-2)",
							}}
						/>
					) : (
						<div
							style={{
								width: 48,
								height: 48,
								borderRadius: 4,
								background: "var(--gf-bg-2)",
								flexShrink: 0,
							}}
						/>
					)}
					<div style={{ flex: 1, minWidth: 0 }}>
						<div
							style={{
								fontSize: 12,
								fontWeight: 500,
								color: "var(--gf-text)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								marginBottom: 4,
							}}
						>
							{sub.title}
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<span
								style={{
									fontSize: 11,
									color: STATUS_COLOR[sub.moderationStatus],
									fontWeight: 600,
								}}
							>
								{STATUS_LABEL[sub.moderationStatus]}
							</span>
							<span style={{ fontSize: 11, color: "var(--gf-muted)" }}>
								{formatRelative(new Date(sub.createdAt))}
							</span>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function formatRelative(date: Date): string {
	const diff = Math.floor((Date.now() - date.getTime()) / 1000);
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}
