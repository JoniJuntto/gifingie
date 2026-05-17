import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import LandingPage from "@/components/landing-page";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const me = useQuery({
		...trpc.me.get.queryOptions(),
		enabled: !!session,
	});

	useEffect(() => {
		if (!session || !me.data) return;
		navigate({
			to:
				me.data.selectedRole === "streamer"
					? "/streamer"
					: me.data.selectedRole === "viewer"
						? "/viewer"
						: "/choose-role",
			replace: true,
		});
	}, [me.data, navigate, session]);

	if (isPending || (session && me.isLoading)) {
		return (
			<div
				className="gf-page"
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flex: 1,
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

	if (session) {
		return null;
	}

	return <LandingPage />;
}
