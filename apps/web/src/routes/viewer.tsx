import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SearchIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/viewer")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [query, setQuery] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedStreamerId, setSelectedStreamerId] = useState<string | null>(
		null,
	);
	const liveStreamers = useQuery(trpc.streamers.listLive.queryOptions());
	const giphy = useQuery({
		...trpc.giphy.search.queryOptions({ query: searchQuery }),
		enabled: searchQuery.length >= 2,
	});
	const submit = useMutation(
		trpc.gifs.submit.mutationOptions({
			onSuccess: async () => {
				toast.success("GIF sent to overlay");
				await queryClient.invalidateQueries();
			},
		}),
	);

	const selectedStreamer =
		liveStreamers.data?.find(
			(streamer) => streamer.id === selectedStreamerId,
		) ?? null;

	return (
		<main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[320px_1fr]">
			<Card>
				<CardHeader>
					<CardTitle>Live streamers</CardTitle>
					<CardDescription>
						Only enrolled channels currently live on Twitch are listed.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{liveStreamers.isLoading ? (
						<Skeleton className="h-20 w-full" />
					) : null}
					{(liveStreamers.data ?? []).map((streamer) => (
						<Button
							key={streamer.id}
							className="justify-start"
							variant={
								streamer.id === selectedStreamerId ? "default" : "outline"
							}
							onClick={() => setSelectedStreamerId(streamer.id)}
						>
							{streamer.twitchDisplayName}
						</Button>
					))}
					{liveStreamers.data?.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No enrolled streamers are live right now.
						</p>
					) : null}
				</CardContent>
			</Card>
			<section className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>Search GIPHY</CardTitle>
						<CardDescription>
							{selectedStreamer
								? `Sending to ${selectedStreamer.twitchDisplayName}`
								: "Select a live streamer first."}
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<form
							className="flex gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								setSearchQuery(query.trim());
							}}
						>
							<Input
								minLength={2}
								placeholder="Search GIFs"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
							<Button
								type="submit"
								disabled={query.trim().length < 2 || giphy.isFetching}
							>
								<SearchIcon data-icon="inline-start" />
								{giphy.isFetching ? "Searching…" : "Search"}
							</Button>
						</form>
						<div className="text-muted-foreground text-xs">
							Powered by GIPHY
						</div>
					</CardContent>
				</Card>
				{giphy.isFetching ? (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton key={index} className="aspect-video w-full" />
						))}
					</div>
				) : null}
				{searchQuery.length >= 2 &&
				!giphy.isFetching &&
				(giphy.data ?? []).length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No GIFs found for &ldquo;{searchQuery}&rdquo;.
					</p>
				) : null}
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{(giphy.data ?? []).map((gif) => (
						<Card key={gif.id} size="sm">
							<img
								alt={gif.title}
								className="aspect-video w-full object-cover"
								src={gif.previewUrl ?? gif.gifUrl}
							/>
							<CardHeader>
								<CardTitle className="truncate">{gif.title}</CardTitle>
							</CardHeader>
							<CardContent>
								<Button
									className="w-full"
									disabled={!selectedStreamer || submit.isPending}
									onClick={() => {
										if (!selectedStreamer) {
											return;
										}
										submit.mutate({
											streamerProfileId: selectedStreamer.id,
											gif,
										});
									}}
								>
									<SendIcon data-icon="inline-start" />
									Send GIF
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			</section>
		</main>
	);
}
