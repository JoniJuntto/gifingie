import { Toaster } from "@my-better-t-app/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
	trpc: typeof trpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{ title: "gifingie — Live GIF reactions for Twitch" },
			{
				name: "description",
				content:
					"Twitch extension and overlay for real-time GIF reactions. GIPHY search, Bits pricing, OBS browser source.",
			},
		],
		links: [
			{ rel: "icon", href: "/favicon.ico" },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
			},
		],
	}),
});

function RootComponent() {
	const location = useLocation();
	const isOverlay = location.pathname.startsWith("/overlay/");

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				disableTransitionOnChange
				storageKey="gf-theme"
			>
				<div className="grid h-svh grid-rows-[auto_1fr]">
					{isOverlay ? null : <Header />}
					<div className="flex min-h-0 flex-col overflow-hidden">
						<Outlet />
					</div>
				</div>
				<Toaster richColors />
			</ThemeProvider>
			{isOverlay ? null : (
				<TanStackRouterDevtools position="bottom-left" />
			)}
		</>
	);
}
