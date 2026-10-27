import { KeyRound, MessageCircle, Send } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/submit";
import { Badge, Button, ButtonLink, Card, CardHeader, Flash, Input, Label, Notice, PageHeader, Select, Textarea, PlainButton } from "@/components/ui";
import { whatsappEnabled } from "@/lib/channels/whatsapp";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/engine/topics";
import { env } from "@/lib/env";
import { canEdit, currentWorkspace, requireActiveUser } from "@/lib/session";
import { effectivePlan, getSettings, periodLabel, usesPlatformAi } from "@/lib/settings";
import { formatInZone, TIMEZONES } from "@/lib/time";
import { changePassword } from "../../(auth)/actions";
import { createLinkCode, removeGeminiKey, saveBrand, saveGeminiKey, unlinkChannel } from "../actions";

// AI writing and LinkedIn uploads can take 20-40s; server actions on this page share this limit.
export const maxDuration = 60;

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace: ws, role } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const settings = await getSettings();
  const plan = effectivePlan(profile);
  const editable = canEdit(role);
  const platformAi = usesPlatformAi(settings, profile);
  const bot = env.telegramBotUsername();

  return (
    <>
      <PageHeader title="Settings" />
      <Flash searchParams={params} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Brand & voice" description={`How the AI writes for "${ws.name}"`} />
          <form action={saveBrand} className="space-y-5 p-5">
            <fieldset disabled={!editable} className="space-y-5">
              <div>
                <Label htmlFor="name">Workspace name</Label>
                <Input id="name" name="name" defaultValue={ws.name} />
              </div>
              <div>
                <Label htmlFor="about" hint="(who you are, what you do)">About</Label>
                <Textarea id="about" name="about" defaultValue={ws.about} maxLength={600} placeholder="Backend developer building fintech payment systems in India. Interested in AI and startups." />
              </div>
              <div>
                <Label htmlFor="audience">Audience</Label>
                <Input id="audience" name="audience" defaultValue={ws.audience} placeholder="Developers, founders and students in India" />
              </div>
              <div>
                <Label htmlFor="voice">Writing voice</Label>
                <Textarea id="voice" name="voice" defaultValue={ws.voice} maxLength={600} className="min-h-20" />
              </div>
              <div>
                <Label>Topics for daily drafts</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORY_IDS.map((id) => (
                    <label key={id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                      <input type="checkbox" name="topics" value={id} defaultChecked={ws.topics.includes(id)} className="size-4 accent-[var(--brand)]" />
                      {CATEGORIES[id].label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select id="timezone" name="timezone" defaultValue={ws.timezone}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="draft_hour">Daily draft at</Label>
                  <Select id="draft_hour" name="draft_hour" defaultValue={ws.draft_hour}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="image_theme">Image style</Label>
                  <Select id="image_theme" name="image_theme" defaultValue={ws.image_theme}>
                    <option value="navy">Navy (dark)</option>
                    <option value="light">Clean light</option>
                    <option value="sunset">Sunset</option>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="auto_draft" defaultChecked={ws.auto_draft} className="size-4 accent-[var(--brand)]" />
                Create a draft for me every day and send it to my chat
              </label>
              {editable && <SubmitButton pending="Saving…">Save</SubmitButton>}
            </fieldset>
          </form>
        </Card>

        <div className="space-y-6">
          <Card id="ai">
            <CardHeader title="AI key" description={platformAi ? "Your account uses our premium AI. No key needed." : "Free plan: posts are written with your own free Gemini key."} />
            <div className="space-y-4 p-5">
              {profile.gemini_key_enc ? (
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="success"><KeyRound className="size-3" /> Key saved (encrypted)</Badge>
                  <form action={removeGeminiKey}><Button variant="ghost" className="text-danger" confirm="Remove your Gemini key? You won't be able to generate posts until you add one again." pending="Removing…">Remove</Button></form>
                </div>
              ) : (
                !platformAi && <Notice tone="warning">No key yet: you can't generate posts.</Notice>
              )}
              {!platformAi && (
                <form action={saveGeminiKey} className="space-y-2">
                  <input type="hidden" name="back" value="/app/settings" />
                  <Input name="key" type="password" placeholder="Paste your Gemini API key" autoComplete="off" required />
                  <SubmitButton variant="secondary" className="w-full" pending="Testing key…">{profile.gemini_key_enc ? "Replace key" : "Save key"}</SubmitButton>
                  <p className="text-xs text-muted">
                    Free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-brand underline">aistudio.google.com/apikey</a>. We test it, encrypt it, and never show it again.
                  </p>
                </form>
              )}
            </div>
          </Card>

          <Card id="channels">
            <CardHeader title="Approve from chat" description="Get drafts on your phone and approve them with one tap." />
            <div className="space-y-4 p-5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium"><Send className="size-4 text-[#229ED9]" /> Telegram</span>
                {profile.telegram_chat_id ? (
                  <form action={unlinkChannel} className="flex items-center gap-2"><input type="hidden" name="channel" value="telegram" /><Badge tone="success">Linked</Badge><PlainButton className="text-xs text-muted hover:text-danger">Unlink</PlainButton></form>
                ) : (
                  <Badge>Not linked</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</span>
                {profile.whatsapp_number ? (
                  <form action={unlinkChannel} className="flex items-center gap-2"><input type="hidden" name="channel" value="whatsapp" /><Badge tone="success">Linked</Badge><PlainButton className="text-xs text-muted hover:text-danger">Unlink</PlainButton></form>
                ) : (
                  <Badge>{whatsappEnabled() ? "Not linked" : "Coming soon"}</Badge>
                )}
              </div>
              {profile.link_code ? (
                <div className="space-y-2 rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-muted">Your one-time code</div>
                  <div className="font-mono text-2xl font-semibold tracking-widest">{profile.link_code}</div>
                  {bot && <ButtonLink href={`https://t.me/${bot}?start=${profile.link_code}`} target="_blank" className="w-full"><Send className="size-4" /> Open Telegram & link</ButtonLink>}
                  {whatsappEnabled() && <p className="text-xs text-muted">WhatsApp: send <b>link {profile.link_code}</b> to our WhatsApp number.</p>}
                </div>
              ) : (
                <form action={createLinkCode}><Button variant="secondary" className="w-full" pending="Creating code…">Get a link code</Button></form>
              )}
            </div>
          </Card>

          <Card id="password">
            <CardHeader title="Password" description={params.reset ? "You're signed in from the reset link. Set a new password now." : undefined} />
            <form action={changePassword} className="space-y-3 p-5">
              <Input name="password" type="password" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} required />
              <Input name="confirm" type="password" placeholder="Repeat new password" autoComplete="new-password" minLength={8} required />
              <SubmitButton variant="secondary" className="w-full" pending="Saving…">Change password</SubmitButton>
            </form>
          </Card>

          <Card id="billing">
            <CardHeader title="Plan" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span>Current plan</span>
                <Badge tone={plan === "pro" ? "brand" : "neutral"}>{plan === "pro" ? "Pro" : "Free"}</Badge>
              </div>
              {profile.paid_until && plan === "pro" && <p className="text-muted">Renews / ends {formatInZone(profile.paid_until, ws.timezone, { dateStyle: "medium" })}</p>}
              <p className="text-muted">
                Daily AI drafts: {plan === "pro" ? settings.pro_daily_drafts : settings.free_daily_drafts} · LinkedIn accounts: {plan === "pro" ? settings.pro_max_accounts : settings.free_max_accounts}
              </p>
              {(settings.razorpay_enabled || settings.lemonsqueezy_enabled) && (
                <ButtonLink href="/onboarding?upgrade=1" className="w-full">
                  {plan === "pro" ? "Extend Pro" : `Upgrade · ₹${settings.price_inr} / ${periodLabel(settings.billing_period_days)}`}
                </ButtonLink>
              )}
              {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && (
                <p className="text-xs text-muted">Questions? <Link href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`} className="underline">Contact support</Link></p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
