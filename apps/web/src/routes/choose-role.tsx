import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/choose-role")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const me = useQuery(trpc.me.get.queryOptions());
	const setRole = useMutation(
		trpc.me.setRole.mutationOptions({
			onSuccess: async (_, variables) => {
				await queryClient.invalidateQueries();
				navigate({
					to: variables.role === "streamer" ? "/streamer" : "/viewer",
					replace: true,
				});
			},
		}),
	);

	return (
		<main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Viewer</CardTitle>
					<CardDescription>
						Land on the GIF submission flow when you sign in.
					</CardDescription>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					Pick live enrolled streamers and send GIPHY GIFs into their overlay
					queue.
				</CardContent>
				<CardFooter>
					<Button
						className="w-full"
						disabled={setRole.isPending || me.isLoading}
						onClick={() => setRole.mutate({ role: "viewer" })}
					>
						Choose viewer
					</Button>
				</CardFooter>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Streamer</CardTitle>
					<CardDescription>
						Land on the OBS overlay dashboard when you sign in.
					</CardDescription>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					Enroll your Twitch channel and copy a private browser-source URL.
				</CardContent>
				<CardFooter>
					<Button
						className="w-full"
						disabled={setRole.isPending || me.isLoading}
						variant="outline"
						onClick={() => setRole.mutate({ role: "streamer" })}
					>
						Choose streamer
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
