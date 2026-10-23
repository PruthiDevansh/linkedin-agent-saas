# Kalam: AI LinkedIn growth agent (SaaS)

Kalam finds trending news in your field, writes a LinkedIn post in your voice, designs the image or carousel, and sends it to Telegram, WhatsApp or the web dashboard for one-tap approval. Then it posts or schedules it for your best time and tracks what works.

## Features

**For users**
- Daily drafts from trending news (12 topics: AI, .NET, web, cloud, security, fintech, startups, product, marketing, careers…), ranked by Hacker News upvotes and Google Trends
- Write from your own idea (with an optional photo), or build a 6–8 slide **carousel** (PDF document post)
- Visuals: key-takeaway card, flowchart, quote card, your photo; 3 brand themes
- **Scheduling** with personalized **best times** (learned from your results)
- **Analytics**: engagement over time, by topic, by visual; top posts
- **Inspiration library**: 30 hook formulas, 8 templates, live trending stories, admin-curated examples
- **Telegram & WhatsApp**: drafts with buttons (post, edit, change image, new draft, skip); send ideas, photos, `/carousel`
- **Teams & agencies**: workspaces per client, multiple LinkedIn accounts, owner/editor/viewer roles, invite links
- Calendar, mobile-friendly UI, light and dark mode

**For the owner (admin)**
- Registration modes: free (users bring their own Gemini key), paid only, or both
- Payments: Razorpay (India, UPI) and Lemon Squeezy (international), each with an on/off switch
- Prices, billing period, plan limits, announcement banner
- User management: usage per user, plans, suspend, grant Pro, record offline payments
- Revenue and growth overview

## Tech

Next.js 16 (App Router, Server Actions) · Supabase (Postgres + Auth, RLS deny-all + server-side checks) · Tailwind CSS 4 · Gemini (with fallback model) · Satori/`next/og` + pdf-lib for images and carousels · LinkedIn Posts/Images/Documents APIs (OAuth 2.0) · Telegram Bot API · WhatsApp Cloud API · Upstash QStash (scheduler fan-out) · Razorpay · Lemon Squeezy

Security: AES-256-GCM encrypted tokens and API keys, signed OAuth state bound to a cookie, webhook signature checks (Telegram, WhatsApp, Razorpay, Lemon Squeezy, QStash), atomic publish claim (no double posts), per-workspace role checks on every action.

## Run

```bash
npm install
cp .env.example .env.local   # fill in values, see SETUP.md
npm run dev
```

Full setup and deployment: [SETUP.md](SETUP.md).

## Map

| Path | What |
|---|---|
| `src/lib/engine/` | Agent: news sources, AI writer, images, LinkedIn, drafts, scheduler, analytics |
| `src/lib/channels/` | Telegram + WhatsApp with one shared chat brain |
| `src/lib/payments.ts` | Razorpay + Lemon Squeezy |
| `src/app/app/` | User portal |
| `src/app/admin/` | Admin panel |
| `src/app/api/` | OAuth, webhooks, jobs, media, payments |
| `supabase/migrations/` | Database schema |
