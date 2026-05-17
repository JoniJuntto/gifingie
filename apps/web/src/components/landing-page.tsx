import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	Gamepad2Icon,
	HelpCircleIcon,
	MicIcon,
	MonitorIcon,
	MusicIcon,
	PaletteIcon,
	RadioIcon,
	SparklesIcon,
	StarIcon,
	TrophyIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";

const HERO_GIFS = [
	{ label: "Surprised", hue: 28 },
	{ label: "Pizza time", hue: 12 },
	{ label: "Cute cat", hue: 200 },
	{ label: "Sounds good", hue: 160 },
	{ label: "LOL", hue: 45 },
	{ label: "Thumbs up", hue: 280 },
] as const;

const MARQUEE_ITEMS = [
	"Real-time GIF playing",
	"Boost livestream engagement",
	"Works with OBS & Streamlabs",
	"GIPHY-powered library",
	"Bits & access controls",
] as const;

const FEATURES = [
	{
		title: "Real-time GIF playing",
		body: "Let your viewers play GIFs on your stream the moment they submit — surfaced through your OBS browser overlay.",
		gifs: ["Wow", "Mind blown", "Applause"],
		hues: [35, 320, 190],
	},
	{
		title: "Vast GIPHY collection",
		body: "Viewers search thousands of trending GIFs from GIPHY. No uploads required — pick, pay (optional), and send.",
		gifs: ["Magic", "Morning", "Wink"],
		hues: [260, 50, 300],
	},
	{
		title: "Perfect for any channel",
		body: "Gamers, talk shows, music streams, creative artists — gifingie fits any vibe and audience.",
		icons: [
			{ Icon: TrophyIcon, label: "Esports" },
			{ Icon: Gamepad2Icon, label: "Gaming" },
			{ Icon: MicIcon, label: "Podcasts" },
			{ Icon: MusicIcon, label: "Music" },
			{ Icon: PaletteIcon, label: "Creative" },
		],
	},
] as const;

const STATS = [
	{ value: "GIPHY", label: "Powered search library" },
	{ value: "OBS+", label: "Browser source compatible" },
	{ value: "Bits", label: "Optional per-GIF pricing" },
] as const;

const STEPS = [
	{
		n: "01",
		title: "Create your account",
		body: 'Sign in with Twitch on gifingie and choose streamer or viewer — you can be both.',
	},
	{
		n: "02",
		title: "Connect to your stream",
		body: "Enroll your channel, copy your overlay URL into OBS (or Streamlabs), and install the Twitch panel extension.",
	},
	{
		n: "03",
		title: "Start engaging",
		body: "Set follower or subscriber gates, charge bits per GIF if you want, and let chat drive the show.",
	},
] as const;

const FAQS = [
	{
		q: "What is gifingie?",
		a: "gifingie is a Twitch extension and stream overlay that lets viewers search GIPHY and send GIFs to your live broadcast. Submissions appear on stream through a browser source you add to OBS or similar software.",
	},
	{
		q: "How much does gifingie cost?",
		a: "Installing and using gifingie is free for streamers. You can optionally require Twitch Bits per GIF submission — revenue goes through Twitch's normal Bits flow.",
	},
	{
		q: "Which streaming software works with gifingie?",
		a: "Any broadcaster that supports browser sources: OBS Studio, Streamlabs Desktop, Twitch Studio, XSplit, and others. Paste your unique overlay URL and you're set.",
	},
	{
		q: "Can I control who sends GIFs?",
		a: "Yes. Restrict submissions to everyone, followers only, or subscribers. Disable GIFs anytime, set Bits pricing, and use moderation tools for channels you mod.",
	},
	{
		q: "How do I set up gifingie on my channel?",
		a: "Sign in, enroll as a streamer in Settings, add the overlay browser source to your scene, then activate the Twitch extension on your channel. Share your channel page so viewers can submit from the web too.",
	},
	{
		q: "Where can I get support?",
		a: "Use the contact link on the sign-in page or reach out through your gifingie dashboard. We're happy to help with overlay setup, Bits products, and extension configuration.",
	},
] as const;

const SOFTWARE = ["OBS Studio", "Streamlabs", "Twitch Studio", "XSplit"] as const;

function GifTile({
	label,
	hue,
	size = "md",
}: {
	label: string;
	hue: number;
	size?: "sm" | "md" | "lg";
}) {
	const dim =
		size === "lg"
			? { w: 140, h: 100, font: 13 }
			: size === "sm"
				? { w: 88, h: 64, font: 10 }
				: { w: 112, h: 80, font: 11 };
	return (
		<div
			className="gf-landing-gif-tile"
			style={{
				width: dim.w,
				height: dim.h,
				background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 65% 42%))`,
				fontSize: dim.font,
			}}
			aria-hidden
		>
			{label}
		</div>
	);
}

function FaqItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="gf-landing-faq-item">
			<button
				type="button"
				className="gf-landing-faq-trigger"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<span>{q}</span>
				<ChevronDownIcon
					size={18}
					style={{
						flexShrink: 0,
						transform: open ? "rotate(180deg)" : "none",
						transition: "transform 0.2s",
						color: "var(--gf-muted)",
					}}
				/>
			</button>
			{open ? <p className="gf-landing-faq-answer">{a}</p> : null}
		</div>
	);
}

export default function LandingPage() {
	const navigate = useNavigate();

	return (
		<div className="gf-landing">
			{/* Hero */}
			<section className="gf-landing-hero" id="top">
				<div className="gf-landing-inner gf-landing-hero-grid">
					<div>
						<p className="gf-eyebrow" style={{ marginBottom: 16 }}>
							Twitch extension &amp; overlay
						</p>
						<h1 className="gf-display gf-landing-hero-title">
							Elevate your Twitch stream
							<br />
							<span style={{ color: "var(--gf-accent)" }}>
								with live GIF reactions
							</span>
						</h1>
						<p className="gf-landing-lead">
							Instantly inject hilarious reactions, epic moments, and on-point
							emotive GIFs into your streams. gifingie is your secret weapon for
							engagement — and optional Bits revenue.
						</p>
						<div className="gf-landing-cta-row">
							<button
								type="button"
								className="gf-btn accent lg"
								onClick={() => navigate({ to: "/login" })}
							>
								Get started with Twitch
								<ArrowRightIcon size={16} />
							</button>
							<button
								type="button"
								className="gf-btn outline lg"
								onClick={() => navigate({ to: "/login" })}
							>
								<MonitorIcon size={16} />
								Streamer setup
							</button>
						</div>
					</div>
					<div className="gf-landing-hero-gifs" aria-hidden>
						{HERO_GIFS.map((g) => (
							<GifTile key={g.label} label={g.label} hue={g.hue} size="md" />
						))}
					</div>
				</div>
			</section>

			{/* Marquee */}
			<div className="gf-landing-marquee-wrap" aria-hidden>
				<div className="gf-landing-marquee">
					{[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
						<span key={`${item}-${i}`} className="gf-landing-marquee-item">
							<SparklesIcon size={12} />
							{item}
						</span>
					))}
				</div>
			</div>

			{/* Features */}
			<section className="gf-landing-section" id="features">
				<div className="gf-landing-inner">
					<p className="gf-eyebrow gf-landing-section-label">Features</p>
					<h2 className="gf-display gf-landing-section-title">
						Everything you need for GIF-powered streams
					</h2>
					<div className="gf-landing-features">
						{FEATURES.map((f) => (
							<article key={f.title} className="gf-landing-feature-card">
								<h3>{f.title}</h3>
								<p>{f.body}</p>
								{"gifs" in f && f.gifs ? (
									<div className="gf-landing-feature-visual">
										{f.gifs.map((label, i) => (
											<GifTile
												key={label}
												label={label}
												hue={f.hues[i] ?? 200}
												size="sm"
											/>
										))}
									</div>
								) : null}
								{"icons" in f && f.icons ? (
									<div className="gf-landing-channel-types">
										{f.icons.map(({ Icon, label }) => (
											<div key={label} className="gf-landing-channel-type">
												<Icon size={20} strokeWidth={1.5} />
												<span>{label}</span>
											</div>
										))}
									</div>
								) : null}
							</article>
						))}
					</div>
				</div>
			</section>

			{/* Software */}
			<section className="gf-landing-section gf-landing-section-muted">
				<div className="gf-landing-inner gf-landing-setup">
					<div>
						<p className="gf-eyebrow gf-landing-section-label">Setup</p>
						<h2 className="gf-display gf-landing-section-title">
							Setting up is a breeze
						</h2>
						<p className="gf-landing-lead" style={{ marginBottom: 0 }}>
							gifingie works with every major streaming stack via a simple
							browser source overlay URL.
						</p>
					</div>
					<div className="gf-landing-software-grid">
						{SOFTWARE.map((name) => (
							<div key={name} className="gf-landing-software-pill">
								<RadioIcon size={16} />
								{name}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Stats */}
			<section className="gf-landing-section">
				<div className="gf-landing-inner">
					<div className="gf-landing-stats-header">
						<ZapIcon size={22} style={{ color: "var(--gf-accent)" }} />
						<div>
							<p className="gf-eyebrow gf-landing-section-label">
								gifingie insights
							</p>
							<h2 className="gf-display gf-landing-section-title">
								Built for engaging audiences
							</h2>
						</div>
					</div>
					<div className="gf-landing-stats">
						{STATS.map((s) => (
							<div key={s.label} className="gf-landing-stat">
								<div className="gf-landing-stat-value">{s.value}</div>
								<div className="gf-landing-stat-label">{s.label}</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="gf-landing-section gf-landing-section-dark" id="how-it-works">
				<div className="gf-landing-inner">
					<div className="gf-landing-steps-header">
						<HelpCircleIcon size={22} />
						<div>
							<p
								className="gf-eyebrow gf-landing-section-label"
								style={{ color: "rgba(255,255,255,0.5)" }}
							>
								How it works
							</p>
							<h2
								className="gf-display gf-landing-section-title"
								style={{ color: "var(--gf-on-inv)" }}
							>
								Get started in three steps
							</h2>
						</div>
					</div>
					<div className="gf-landing-steps">
						{STEPS.map((step) => (
							<div key={step.n} className="gf-landing-step">
								<span className="gf-landing-step-n">{step.n}</span>
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</div>
						))}
					</div>
					<button
						type="button"
						className="gf-btn accent lg"
						style={{ marginTop: 48 }}
						onClick={() => navigate({ to: "/login" })}
					>
						Add to your channel
						<ArrowRightIcon size={16} />
					</button>
				</div>
			</section>

			{/* FAQ */}
			<section className="gf-landing-section" id="faq">
				<div className="gf-landing-inner gf-landing-faq-grid">
					<div>
						<p className="gf-eyebrow gf-landing-section-label">FAQ</p>
						<h2 className="gf-display gf-landing-section-title">
							Frequently asked questions
						</h2>
						<p className="gf-landing-lead">
							Quick answers about pricing, setup, and moderation.
						</p>
						<div className="gf-landing-faq-deco" aria-hidden>
							<GifTile label="Got it!" hue={140} size="lg" />
						</div>
					</div>
					<div className="gf-landing-faq-list">
						{FAQS.map((item) => (
							<FaqItem key={item.q} q={item.q} a={item.a} />
						))}
					</div>
				</div>
			</section>

			{/* Footer CTA */}
			<footer className="gf-landing-footer">
				<div className="gf-landing-inner gf-landing-footer-inner">
					<div className="gf-landing-footer-brand">
						<span className="gf-mark">g</span>
						<span style={{ fontWeight: 500, letterSpacing: "-0.03em" }}>
							gifingie
						</span>
						<p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--gf-muted)" }}>
							A Twitch extension for live GIF reactions.
						</p>
					</div>
					<div className="gf-landing-footer-links">
						<Link to="/login" className="gf-nav-link">
							Sign in
						</Link>
						<a href="#features" className="gf-nav-link">
							Features
						</a>
						<a href="#how-it-works" className="gf-nav-link">
							How it works
						</a>
						<a href="#faq" className="gf-nav-link">
							FAQ
						</a>
					</div>
					<p className="gf-landing-copyright">
						<StarIcon size={12} style={{ display: "inline", verticalAlign: -2 }} />{" "}
						Copyright © {new Date().getFullYear()} gifingie
					</p>
				</div>
			</footer>
		</div>
	);
}
