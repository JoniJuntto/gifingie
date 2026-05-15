import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

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
		if (!session || !me.data) {
			return;
		}

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

	if (isPending || me.isLoading) {
		return (
			<main className="p-6 text-muted-foreground text-sm">Loading...</main>
		);
	}

	return (
		<main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 md:grid-cols-[1fr_1fr]">
			<Card>
				<CardHeader>
					<CardTitle>Send GIFs to live overlays</CardTitle>
					<CardDescription>
						Choose a live enrolled Twitch streamer, search GIPHY, and send one
						GIF at a time.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button render={<Link to={session ? "/viewer" : "/login"} />}>
						Open viewer flow
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Run an OBS browser source</CardTitle>
					<CardDescription>
						Enroll your Twitch channel and get a private overlay URL for
						submitted GIFs.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						variant="outline"
						render={<Link to={session ? "/streamer" : "/login"} />}
					>
						Open streamer dashboard
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}
