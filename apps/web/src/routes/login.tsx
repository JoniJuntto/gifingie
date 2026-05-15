import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { RadioIcon } from "lucide-react";

import { appUrl, authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<main className="mx-auto flex w-full max-w-md items-center px-4 py-12">
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Twitch GIF Overlay</CardTitle>
					<CardDescription>
						Sign in with Twitch to send GIFs or enroll your overlay.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						className="w-full"
						onClick={() =>
							authClient.signIn.social({
								provider: "twitch",
								callbackURL: appUrl("/choose-role"),
							})
						}
					>
						<RadioIcon data-icon="inline-start" />
						Continue with Twitch
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}
