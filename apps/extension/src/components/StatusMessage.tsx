type Props = {
	children: React.ReactNode;
	variant?: "default" | "error";
};

export function StatusMessage({ children, variant = "default" }: Props) {
	return (
		<div
			style={{
				padding: "24px 16px",
				textAlign: "center",
				color:
					variant === "error" ? "var(--gf-live)" : "var(--gf-muted)",
				fontSize: 13,
				lineHeight: 1.5,
			}}
		>
			{children}
		</div>
	);
}
