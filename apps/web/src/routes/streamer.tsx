import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CopyIcon, RadioIcon, RefreshCwIcon } from "lucide-react";
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

function RouteComponent() {
	const me = useQuery(trpc.me.get.queryOptions());
	const recent = useQuery(trpc.streamer.recentSubmissions.queryOptions());
	const enroll = useMutation(
		trpc.streamer.enroll.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.success("Streamer channel enrolled");
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

	if (me.isLoading) {
		return (
			<main className="p-6">
				<Skeleton className="h-32 w-full" />
			</main>
		);
	}

	const profile = me.data?.streamerProfile;
	const overlayUrl = profile
		? `${window.location.origin}/overlay/${profile.overlayToken}`
		: "";

	return (
		<main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
			<section className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>Streamer dashboard</CardTitle>
						<CardDescription>
							Enroll your Twitch channel and use the private URL as an OBS
							browser source.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{profile ? (
							<>
								<div className="flex items-center gap-3">
									{profile.twitchAvatarUrl ? (
										<img
											alt=""
											className="size-10 rounded-none"
											src={profile.twitchAvatarUrl}
										/>
									) : null}
									<div>
										<div className="font-medium">
											{profile.twitchDisplayName}
										</div>
										<div className="text-muted-foreground text-xs">
											@{profile.twitchChannelLogin}
										</div>
									</div>
								</div>
								<label className="flex flex-col gap-1 text-xs">
									OBS overlay URL
									<input
										className="h-9 border bg-background px-2 font-mono text-xs"
										readOnly
										value={overlayUrl}
									/>
								</label>
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								No streamer channel is enrolled yet.
							</p>
						)}
					</CardContent>
					<CardFooter className="gap-2">
						<Button disabled={enroll.isPending} onClick={() => enroll.mutate()}>
							<RadioIcon data-icon="inline-start" />
							{profile ? "Refresh enrollment" : "Enroll channel"}
						</Button>
						{profile ? (
							<>
								<Button
									variant="outline"
									onClick={() => {
										navigator.clipboard.writeText(overlayUrl);
										toast.success("Overlay URL copied");
									}}
								>
									<CopyIcon data-icon="inline-start" />
									Copy URL
								</Button>
								<Button
									disabled={regenerate.isPending}
									variant="outline"
									onClick={() => regenerate.mutate()}
								>
									<RefreshCwIcon data-icon="inline-start" />
									Regenerate
								</Button>
							</>
						) : null}
					</CardFooter>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Recent submissions</CardTitle>
						<CardDescription>Latest GIFs sent to your overlay.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-2 sm:grid-cols-2">
						{(recent.data ?? []).map((gif) => (
							<div
								key={gif.id}
								className="grid grid-cols-[64px_1fr] gap-3 border p-2"
							>
								<img
									alt=""
									className="h-12 w-16 object-cover"
									src={gif.gifUrl}
								/>
								<div className="min-w-0">
									<div className="truncate font-medium">{gif.title}</div>
									<div className="text-muted-foreground text-xs">
										{gif.displayedAt ? "Displayed" : "Waiting"}
									</div>
								</div>
							</div>
						))}
						{recent.data?.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No GIFs have been submitted yet.
							</p>
						) : null}
					</CardContent>
				</Card>
			</section>
			<Card>
				<CardHeader>
					<CardTitle>Preview</CardTitle>
					<CardDescription>
						The overlay itself stays transparent in OBS.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{profile ? (
						<iframe
							className="aspect-video w-full border bg-black"
							src={overlayUrl}
							title="Overlay feed check"
						/>
					) : (
						<div className="aspect-video border bg-muted" />
					)}
				</CardContent>
			</Card>
		</main>
	);
}
