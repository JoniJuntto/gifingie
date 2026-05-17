import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
	const initials = name
		.split(/[\s_.@]/)
		.filter(Boolean)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
	const hue = hash % 360;
	return (
		<span
			className="gf-avatar"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.36,
				background: `linear-gradient(135deg, hsl(${hue} 60% 50%), hsl(${(hue + 40) % 360} 60% 40%))`,
			}}
		>
			{initials}
		</span>
	);
}

const NAV_LINKS = [
	{ to: "/viewer", label: "Browse" },
	{ to: "/streamer", label: "Dashboard" },
	{ to: "/settings", label: "Settings" },
] as const;

const MARKETING_LINKS = [
	{ href: "/#features", label: "Features" },
	{ href: "/#how-it-works", label: "How it works" },
	{ href: "/#faq", label: "FAQ" },
] as const;

export default function Header() {
	const location = useLocation();
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const { theme, setTheme } = useTheme();
	const modChannels = useQuery({
		...trpc.moderation.myChannels.queryOptions(),
		enabled: Boolean(session && !session.user.isAnonymous),
		retry: false,
	});
	const showModerationLink =
		Boolean(modChannels.data?.needsReconnect) ||
		(modChannels.data?.channels.length ?? 0) > 0 ||
		location.pathname.startsWith("/moderation");

	const navLinks = showModerationLink
		? [...NAV_LINKS, { to: "/moderation", label: "Moderation" } as const]
		: NAV_LINKS;
	const activeLink = navLinks.find((l) =>
		location.pathname.startsWith(l.to),
	)?.to;

	const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
	const isLanding = location.pathname === "/";
	const showMarketingNav = isLanding && !session;

	return (
		<nav className="gf-nav">
			{/* Logo */}
			<Link
				to="/"
				style={{
					display: "flex",
					alignItems: "center",
					gap: 10,
					textDecoration: "none",
				}}
			>
				<span className="gf-mark">g</span>
				<span
					style={{
						fontSize: 17,
						fontWeight: 500,
						letterSpacing: "-0.03em",
						color: "var(--gf-text)",
						fontFamily: "var(--gf-font-ui)",
					}}
				>
					gifingie
				</span>
				{showMarketingNav ? (
					<span
						style={{
							fontSize: 12,
							color: "var(--gf-muted)",
							fontWeight: 400,
							marginLeft: 4,
						}}
					>
						· Twitch extension
					</span>
				) : null}
			</Link>

			{/* Nav links */}
			{showMarketingNav ? (
				<div style={{ display: "flex", gap: 24 }}>
					{MARKETING_LINKS.map(({ href, label }) => (
						<a key={href} href={href} className="gf-nav-link">
							{label}
						</a>
					))}
					<Link to="/login" className="gf-nav-link">
						Dashboard
					</Link>
				</div>
			) : session ? (
				<div style={{ display: "flex", gap: 24 }}>
					{navLinks.map(({ to, label }) => (
						<Link
							key={to}
							to={to}
							className={
								activeLink === to ? "active gf-nav-link" : "gf-nav-link"
							}
						>
							{to === "/moderation" ? <ShieldCheckIcon size={13} /> : null}
							{label}
						</Link>
					))}
				</div>
			) : null}

			{/* Right section */}
			<div
				style={{
					marginLeft: "auto",
					display: "flex",
					alignItems: "center",
					gap: 20,
				}}
			>
				<button
					type="button"
					className="gf-btn ghost"
					onClick={toggleTheme}
					title="Toggle theme"
					style={{ padding: "4px" }}
				>
					{theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
				</button>

				{session ? (
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<Avatar name={session.user.name ?? "User"} size={28} />
						<span
							style={{
								fontSize: 14,
								fontWeight: 500,
								letterSpacing: "-0.01em",
								fontFamily: "var(--gf-font-ui)",
								color: "var(--gf-text)",
							}}
						>
							{session.user.name}
						</span>
						<button
							type="button"
							className="gf-btn ghost"
							style={{ fontSize: 13, marginLeft: 4 }}
							onClick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => navigate({ to: "/login" }),
									},
								})
							}
						>
							Sign out
						</button>
					</div>
				) : showMarketingNav ? (
					<Link to="/login" className="gf-btn sm accent">
						Get started
					</Link>
				) : (
					<Link to="/login" className="gf-btn sm outline">
						Sign in
					</Link>
				)}
			</div>
		</nav>
	);
}
