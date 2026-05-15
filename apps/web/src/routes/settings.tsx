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

export const Route = createFileRoute("/settings")({
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
			onSuccess: () => queryClient.invalidateQueries(),
		}),
	);

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
			<Card>
				<CardHeader>
					<CardTitle>Default landing</CardTitle>
					<CardDescription>
						Your role choice controls where you land after signing in.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex gap-2">
					<Button
						disabled={setRole.isPending}
						variant={me.data?.selectedRole === "viewer" ? "default" : "outline"}
						onClick={() => setRole.mutate({ role: "viewer" })}
					>
						Viewer
					</Button>
					<Button
						disabled={setRole.isPending}
						variant={
							me.data?.selectedRole === "streamer" ? "default" : "outline"
						}
						onClick={() => setRole.mutate({ role: "streamer" })}
					>
						Streamer
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Streamer enrollment</CardTitle>
					<CardDescription>
						{me.data?.streamerProfile?.isEnrolled
							? `Enrolled as ${me.data.streamerProfile.twitchDisplayName}`
							: "No streamer channel is enrolled."}
					</CardDescription>
				</CardHeader>
				<CardFooter className="gap-2">
					<Button
						variant="outline"
						onClick={() => navigate({ to: "/streamer" })}
					>
						Open streamer dashboard
					</Button>
					<Button
						variant="destructive"
						onClick={() =>
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => navigate({ to: "/" }),
								},
							})
						}
					>
						Sign out
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
