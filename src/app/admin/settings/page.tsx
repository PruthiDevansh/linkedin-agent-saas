import { CheckCircle2, XCircle } from "lucide-react";
import { SubmitButton } from "@/components/submit";
import { Button, Card, CardHeader, Flash, Input, Label, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { saveAppSettings, setupScheduler, setupTelegram } from "../actions";

export const metadata = { title: "Admin settings" };

const MODES = [
  { value: "free_byok", title: "Free registration", text: "Anyone can join free. They add their own Gemini key. (Good for the launch phase.)" },
  { value: "both", title: "Free + Paid", text: "Free with own key, or pay for Pro (platform AI, higher limits)." },
  { value: "paid", title: "Paid only", text: "New users must pay before using the app." },
];

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();
  const s = await getSettings();

  const integrations: [string, boolean, string][] = [
    ["Supabase", true, "Database & login"],
    ["Encryption key", !!process.env.ENCRYPTION_KEY, "Protects tokens and user keys"],
    ["Platform Gemini key", !!env.geminiKey(), "Used for Pro users"],
    ["LinkedIn app", !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET), "Posting"],
    ["Telegram bot", !!(env.telegramToken() && env.telegramBotUsername()), "Chat approval"],
    ["WhatsApp Cloud API", !!(env.whatsappToken() && env.whatsappPhoneNumberId() && env.whatsappAppSecret()), "Chat approval (optional)"],
    ["QStash scheduler", !!(env.qstashToken() && env.qstashCurrentKey()), "Scheduled posts & daily drafts"],
    ["Razorpay", !!(env.razorpayKeyId() && env.razorpayKeySecret()), "India payments"],
    ["Lemon Squeezy", !!(env.lemonApiKey() && env.lemonStoreId() && env.lemonVariantId()), "International payments"],
  ];

  return (
    <>
      <PageHeader title="App settings" description="Changes apply to everyone immediately." />
      <Flash searchParams={params} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={saveAppSettings} className="space-y-6">
          <Card>
            <CardHeader title="Registration" description="How new people join" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {MODES.map((m) => (
                <label key={m.value} className="cursor-pointer rounded-xl border border-border p-4 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" name="registration_mode" value={m.value} defaultChecked={s.registration_mode === m.value} className="sr-only" />
                  <div className="font-medium">{m.title}</div>
                  <p className="mt-1 text-xs text-muted">{m.text}</p>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing & payments" />
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div><Label htmlFor="price_inr">Price (₹)</Label><Input id="price_inr" name="price_inr" type="number" min={1} defaultValue={s.price_inr} /></div>
                <div><Label htmlFor="price_usd">Price ($)</Label><Input id="price_usd" name="price_usd" type="number" min={1} step="0.01" defaultValue={s.price_usd} /></div>
                <div>
                  <Label htmlFor="billing_period_days">Billing period</Label>
                  <Select id="billing_period_days" name="billing_period_days" defaultValue={s.billing_period_days}>
                    <option value={30}>Monthly</option>
                    <option value={90}>Quarterly</option>
                    <option value={365}>Yearly</option>
                    <option value={0}>Lifetime (one-time)</option>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="razorpay_enabled" defaultChecked={s.razorpay_enabled} className="size-4 accent-[var(--brand)]" /> Razorpay (India: UPI, cards)</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="lemonsqueezy_enabled" defaultChecked={s.lemonsqueezy_enabled} className="size-4 accent-[var(--brand)]" /> Lemon Squeezy (international)</label>
              </div>
              <p className="text-xs text-muted">Use Razorpay test keys first. Payment is a one-time charge per period; users can renew from Settings.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Plan limits" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div><Label htmlFor="free_daily_drafts">Free: AI drafts / 24h</Label><Input id="free_daily_drafts" name="free_daily_drafts" type="number" min={0} defaultValue={s.free_daily_drafts} /></div>
              <div><Label htmlFor="pro_daily_drafts">Pro: AI drafts / 24h</Label><Input id="pro_daily_drafts" name="pro_daily_drafts" type="number" min={1} defaultValue={s.pro_daily_drafts} /></div>
              <div><Label htmlFor="free_max_accounts">Free: LinkedIn accounts</Label><Input id="free_max_accounts" name="free_max_accounts" type="number" min={1} defaultValue={s.free_max_accounts} /></div>
              <div><Label htmlFor="pro_max_accounts">Pro: LinkedIn accounts</Label><Input id="pro_max_accounts" name="pro_max_accounts" type="number" min={1} defaultValue={s.pro_max_accounts} /></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Announcement" description="Shown at the top of every user's dashboard. Leave empty to hide." />
            <div className="p-5"><Textarea name="announcement" defaultValue={s.announcement ?? ""} className="min-h-20" placeholder="🎉 Carousels are here! Try them from Create." /></div>
          </Card>

          <SubmitButton pending="Saving…">Save settings</SubmitButton>
        </form>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Integrations" description="Set in Vercel environment variables" />
            <ul className="divide-y divide-border text-sm">
              {integrations.map(([name, ok, what]) => (
                <li key={name} className="flex items-center gap-3 px-5 py-2.5">
                  {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-muted" />}
                  <div className="min-w-0"><div className="font-medium">{name}</div><div className="text-xs text-muted">{what}</div></div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="One-time setup" />
            <div className="space-y-3 p-5">
              <form action={setupTelegram}><Button variant="secondary" className="w-full">Connect Telegram bot</Button></form>
              <form action={setupScheduler}><Button variant="secondary" className="w-full">Start 15-min scheduler</Button></form>
              <Notice tone="neutral">Run both once after deploying, and again if you change the site address.</Notice>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
