import {
  BarChart3,
  CalendarClock,
  Check,
  Images,
  Lightbulb,
  MessageCircle,
  Newspaper,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { APP_NAME, Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { getSettings, periodLabel } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

const FEATURES = [
  { icon: Newspaper, title: "Daily drafts from trending news", text: "Every morning the agent reads tech, AI, fintech and startup news, checks what's going viral, and writes a post in your voice." },
  { icon: Send, title: "Approve from Telegram or WhatsApp", text: "Drafts arrive on your phone with buttons: post, edit, change image, new draft. One tap and it's live." },
  { icon: Images, title: "Images & carousels, designed for you", text: "Key-takeaway cards, flowcharts, quote cards and swipeable PDF carousels, in your brand style. Or add your own photo." },
  { icon: CalendarClock, title: "Best-time scheduling", text: "Schedule posts for when your audience is most active. The agent learns your best slots from your results." },
  { icon: BarChart3, title: "Analytics that teach", text: "See which topics, formats and visuals get the most engagement, so every post does better than the last." },
  { icon: Lightbulb, title: "Inspiration library", text: "Proven hook formulas, post templates and trending stories in your niche. Click any to write with it." },
  { icon: Users, title: "Teams & agencies", text: "Separate workspaces per client, multiple LinkedIn accounts, and editor or viewer roles for your team." },
  { icon: ShieldCheck, title: "Safe by design", text: "Official LinkedIn API only, no bots or scraping. Nothing posts without your approval. Keys are encrypted." },
];

const STEPS = [
  ["Tell us about you", "Your role, audience, voice and topics. Takes 2 minutes."],
  ["Connect LinkedIn", "Official, secure login. We never see your password."],
  ["Get drafts daily", "On Telegram, WhatsApp or the web, with images ready."],
  ["Tap to post", "Post now or schedule for your best time."],
];

const FAQ = [
  ["Will this get my LinkedIn account banned?", "No. We only use LinkedIn's official API with your permission. There is no scraping, auto-liking or fake engagement, and every post needs your approval."],
  ["Does the AI make things up?", "Each news post is written only from the source article, and the source link is shown to you before posting so you can check it."],
  ["What is the free plan's Gemini key?", "Google gives free API keys at aistudio.google.com. On the free plan the AI runs on your key; Pro runs on ours, so there's nothing to set up."],
  ["Can I use it for clients?", "Yes. Create a workspace per client, connect their LinkedIn, set their voice, and invite them as viewers or editors."],
];

async function loadSettings(): Promise<AppSettings | null> {
  try {
    return await getSettings();
  } catch {
    return null; // Landing page still works before the database is set up.
  }
}

export default async function Home() {
  const s = await loadSettings();
  const payOn = !!s && (s.razorpay_enabled || s.lemonsqueezy_enabled);
  const freeOn = !s || s.registration_mode !== "paid";

  return (
    <div className="overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block">Features</a>
            <a href="#pricing" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-text sm:block">Pricing</a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2">Log in</Link>
            <ButtonLink href="/register">Start free</ButtonLink>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--brand-soft),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-success" /> Your AI LinkedIn growth agent
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
              Post on LinkedIn every day. <span className="text-brand">Without writing.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
              {APP_NAME} finds what's trending in your field, writes a post in your voice, designs the image, and sends it to your phone. You tap approve.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" className="px-5 py-2.5 text-base">{freeOn ? "Start free" : "Get started"}</ButtonLink>
              <ButtonLink href="#how" variant="secondary" className="px-5 py-2.5 text-base">See how it works</ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">No credit card for the free plan · Official LinkedIn API · Cancel anytime</p>
          </div>

          {/* Product mock: a draft arriving on Telegram */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/20 to-transparent blur-2xl" />
            <div className="rounded-3xl border border-border bg-surface p-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-border pb-3 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-[#229ED9] text-white"><Send className="size-4" /></span>
                <div><div className="font-semibold">{APP_NAME} Agent</div><div className="text-xs text-muted">bot · 8:30 AM</div></div>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl bg-gradient-to-br from-[#0b1f33] to-[#12395e] p-5 text-white">
                <div className="text-[10px] uppercase tracking-widest text-[#4fb3ff]">Key takeaways</div>
                <div className="mt-2 text-xl font-semibold leading-tight">Auditing code written by AI agents</div>
                <div className="mt-3 space-y-1.5 text-xs text-white/85">
                  <div>① Passing tests ≠ safe architecture</div>
                  <div>② Agents change code outside the ticket</div>
                  <div>③ Review them like a junior developer</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">
                <b>Your AI coding agent fixed the bug. But what else did it change?</b>
                <br />
                <span className="text-muted">We celebrate green checks. But an agent that "fixes" a ticket can quietly rewrite…</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium">
                {["✅ Post to LinkedIn", "✏️ Edit", "🖼 Change image", "🗓 Best time"].map((b) => (
                  <div key={b} className="rounded-lg bg-surface-2 py-2 text-center">{b}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Everything a LinkedIn creator needs</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Research, writing, design, scheduling and analytics in one agent, working for you every day.</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-bg p-5">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Live in 5 minutes</h2>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-border bg-surface p-5">
                <div className="text-sm font-semibold text-brand">Step {i + 1}</div>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><Send className="size-4 text-[#229ED9]" /> Telegram</span>
            <span className="inline-flex items-center gap-2"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</span>
            <span className="inline-flex items-center gap-2"><BarChart3 className="size-4 text-brand" /> Web dashboard</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Simple pricing</h2>
          <div className={`mt-12 grid gap-6 ${freeOn && payOn ? "md:grid-cols-2" : "mx-auto max-w-md"}`}>
            {freeOn && (
              <div className="rounded-2xl border border-border bg-bg p-6">
                <h3 className="text-lg font-semibold">Free</h3>
                <div className="mt-2 text-4xl font-semibold">₹0</div>
                <p className="mt-1 text-sm text-muted">Bring your own free Gemini key</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {[`${s?.free_daily_drafts ?? 5} AI drafts a day`, `${s?.free_max_accounts ?? 1} LinkedIn account`, "Images, carousels & scheduling", "Telegram & WhatsApp approval", "Analytics"].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-success" />{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/register" variant="secondary" className="mt-6 w-full">Start free</ButtonLink>
              </div>
            )}
            {payOn && s && (
              <div className="rounded-2xl border-2 border-brand bg-bg p-6">
                <h3 className="text-lg font-semibold">Pro</h3>
                <div className="mt-2 text-4xl font-semibold">₹{s.price_inr}<span className="text-base font-normal text-muted"> / {periodLabel(s.billing_period_days)}</span></div>
                <p className="mt-1 text-sm text-muted">{s.lemonsqueezy_enabled ? `or $${s.price_usd} internationally` : "Premium AI included"}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {["Premium AI, no key needed", `${s.pro_daily_drafts} AI drafts a day`, `${s.pro_max_accounts} LinkedIn accounts`, "Team workspaces for clients", "Priority support"].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-brand" />{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/register" className="mt-6 w-full">Go Pro</ButtonLink>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} {APP_NAME}. Not affiliated with LinkedIn.</span>
        </div>
      </footer>
    </div>
  );
}
