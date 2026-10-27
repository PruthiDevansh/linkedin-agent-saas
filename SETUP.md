# Kalam setup guide

Time: about 1 hour, one time. Everything except payments is free to start.

> **Keep secrets secret.** Keys go only in `.env.local` (your computer) and Vercel → Settings → Environment Variables. Never in GitHub or chat.

> **Selling on Vercel:** Vercel's free Hobby plan is for non-commercial use only. Build and test on Hobby, then upgrade to **Pro (~$20/month)** before you take money.

---

## 1. Supabase (database + login) · 10 min

1. Go to https://supabase.com → **New project** (free). Pick the **Mumbai** region if you're in India. Save the database password.
2. **SQL Editor** → **New query** → paste everything from `supabase/migrations/0001_init.sql` → **Run**. Then do the same with `supabase/migrations/0002_admin.sql` (admin invites, built-in AI switch, email-confirmation setting).
3. **Project Settings → API**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never share)
4. **Authentication → URL Configuration** (after step 3 below, when you know your site address):
   - Site URL: `https://YOUR-APP.vercel.app`
   - Redirect URLs: add `https://YOUR-APP.vercel.app/auth/callback`
5. Optional: **Authentication → Providers → Email**: keep "Confirm email" on for real users.

## 2. Secrets you make yourself

Run this 3 times and save each result:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- `ENCRYPTION_KEY` (never change it after launch, or saved tokens can't be read)
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET`

Set `ADMIN_EMAILS` to **your** email. When you register with it, you become the admin.

## 3. Deploy on Vercel · 10 min

1. Push this repo to GitHub (PruthiDevansh), then on https://vercel.com → **Add New → Project** → import it.
2. Add environment variables (at least Supabase + `ENCRYPTION_KEY` + `ADMIN_EMAILS` + `NEXT_PUBLIC_APP_NAME`).
3. Deploy. Copy your address, e.g. `https://kalam-xyz.vercel.app`, and set `APP_URL` to it. Redeploy.
4. Register on your site with your admin email. Open **/admin**.

## 4. AI

- **Free users** add their own key (free at https://aistudio.google.com/apikey). Nothing to do.
- **Pro users** use yours: set `GEMINI_API_KEY`. For reliability with paying users, turn on billing for that key in Google AI Studio (paid tier = higher limits, fewer "overloaded" errors).

## 5. LinkedIn app · 5 min

You can reuse your existing "Devansh Post Agent" app:

1. https://www.linkedin.com/developers/apps → your app → **Auth** → add redirect URL
   `https://YOUR-APP.vercel.app/api/linkedin/callback`
2. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in Vercel.
3. Products needed: **Share on LinkedIn** + **Sign In with LinkedIn using OpenID Connect** (already added).

> Many users on one app: LinkedIn applies daily rate limits per app. When you grow, apply for higher limits in the developer portal.

## 6. Telegram bot · 5 min

A Telegram bot can only send to one website, so make a **new** bot for Kalam (keep your personal one as it is):

1. @BotFather → `/newbot` → e.g. `KalamAgentBot`.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` (without @). Redeploy.
3. **Admin → Settings → Connect Telegram bot**.
4. Users link from **Settings → Approve from chat**.

## 7. Scheduler (QStash) · 5 min

Needed for scheduled posts and daily drafts at each user's chosen hour.

1. https://console.upstash.com → **QStash** (free tier) → copy `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
2. Add them in Vercel, redeploy.
3. **Admin → Settings → Start 15-min scheduler**.

Without QStash, a daily Vercel Cron still runs once a day (8:00 AM IST) as a fallback.

## 8. Payments

Admin → Settings → choose **Registration**: Free (own key) / Free + Paid / Paid only. Turn payment providers on only after their keys are set.

**Razorpay (India):**
1. https://dashboard.razorpay.com → **Test mode** → API Keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Webhooks → add `https://YOUR-APP.vercel.app/api/pay/razorpay/webhook`, events **order.paid** and **payment.failed**, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Test with Razorpay's test cards/UPI. For real money: complete KYC, switch to Live keys.

**Lemon Squeezy (international):**
1. Create a store and a product with one variant → note `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`.
2. Settings → API → `LEMONSQUEEZY_API_KEY`.
3. Settings → Webhooks → `https://YOUR-APP.vercel.app/api/pay/lemon/webhook`, event **order_created**, signing secret → `LEMONSQUEEZY_WEBHOOK_SECRET`.

## 9. WhatsApp (optional) · 30+ min

1. https://developers.facebook.com → create an app (type **Business**) → add **WhatsApp**.
2. Copy a permanent access token → `WHATSAPP_TOKEN`, the phone number ID → `WHATSAPP_PHONE_NUMBER_ID`, App Settings → Basic → App Secret → `WHATSAPP_APP_SECRET`. Make up `WHATSAPP_VERIFY_TOKEN`.
3. WhatsApp → Configuration → Webhook URL `https://YOUR-APP.vercel.app/api/whatsapp/webhook`, verify token = yours, subscribe to **messages**.
4. Users link by sending `link CODE` to your WhatsApp number.

> **Meta's 24-hour rule:** businesses can only message a user freely within 24 hours of the user's last message. Daily drafts reach WhatsApp users who chatted that day; for others, use Telegram or the dashboard. (Proactive WhatsApp needs paid, pre-approved template messages.)

---

## Admin panel

- **/admin**: users, Pro count, revenue, signups, most active users
- **/admin/users**: search and filter; open a user to activate/suspend, grant Pro days, lifetime Pro, record an offline payment, make admin
- **/admin/settings**: registration mode, prices, billing period, payment toggles, plan limits, announcement banner, integration checklist
- **/admin/payments**: every payment
- **/admin/library**: curated examples, hooks and templates for all users
