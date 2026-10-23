import { Check, KeyRound, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { PayButtons } from "@/components/pay-buttons";
import { SubmitButton } from "@/components/submit";
import { Badge, Card, Flash, Input, Notice } from "@/components/ui";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { effectivePlan, getSettings, periodLabel } from "@/lib/settings";
import { signOut } from "../(auth)/actions";
import { saveGeminiKey } from "../app/actions";

export const metadata = { title: "Choose your plan" };

const PRO_FEATURES = ["Premium AI, no key needed", "More daily drafts & LinkedIn accounts", "Carousels, images & best-time scheduling", "Priority support"];
const FREE_FEATURES = ["Use your own free Gemini key", "Daily drafts from trending news", "Telegram & WhatsApp approval", "Images, carousels & analytics"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireUser();
  const settings = await getSettings();
  const plan = effectivePlan(profile);
  const payEnabled = settings.razorpay_enabled || settings.lemonsqueezy_enabled;
  const mustPay = profile.status === "pending_payment";
  const showFree = !mustPay && settings.registration_mode !== "paid";
  const showPro = payEnabled && (mustPay || settings.registration_mode !== "free_byok" || params.upgrade === "1");

  // Nothing to choose: go straight in.
  if (!mustPay && !params.upgrade && (plan === "pro" || profile.gemini_key_enc)) redirect("/app");
  const period = periodLabel(settings.billing_period_days);

  return (
    <div className="min-h-dvh px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Logo />
        <form action={signOut}><button className="text-sm text-muted hover:text-text">Log out</button></form>
      </div>
      <div className="mx-auto mt-10 max-w-4xl">
        <h1 className="text-center text-3xl font-semibold tracking-tight">{mustPay ? "Activate your account" : "Choose how you'd like to start"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">
          {mustPay ? "Complete payment to start growing on LinkedIn." : "You can upgrade any time from Settings."}
        </p>
        <div className="mt-8"><Flash searchParams={params} /></div>
        {mustPay && !payEnabled && <Notice tone="warning">Payments are being set up. Please check back soon or contact support.</Notice>}

        <div className={`mt-6 grid gap-6 ${showFree && showPro ? "md:grid-cols-2" : "mx-auto max-w-md"}`}>
          {showFree && (
            <Card className="flex flex-col p-6">
              <div className="flex items-center gap-2"><KeyRound className="size-5 text-muted" /><h2 className="text-lg font-semibold">Free</h2></div>
              <p className="mt-1 text-sm text-muted">Bring your own free Gemini API key.</p>
              <div className="mt-4 text-3xl font-semibold">₹0</div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {FREE_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-success" />{f}</li>)}
              </ul>
              <form action={saveGeminiKey} className="mt-6 space-y-2">
                <input type="hidden" name="back" value="/onboarding" />
                <Input name="key" type="password" placeholder="Paste your Gemini API key" autoComplete="off" required />
                <SubmitButton variant="secondary" className="w-full" pending="Testing your key…">Start free</SubmitButton>
                <p className="text-xs text-muted">
                  Get one free in 1 minute at <a className="text-brand underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>
                </p>
              </form>
            </Card>
          )}
          {showPro && (
            <Card className="relative flex flex-col border-brand p-6 shadow-[0_0_0_1px_var(--brand)]">
              <div className="absolute -top-3 left-6"><Badge tone="brand">Recommended</Badge></div>
              <div className="flex items-center gap-2"><Sparkles className="size-5 text-brand" /><h2 className="text-lg font-semibold">Pro</h2></div>
              <p className="mt-1 text-sm text-muted">Everything, on our premium AI.</p>
              <div className="mt-4 text-3xl font-semibold">
                ₹{settings.price_inr}<span className="text-base font-normal text-muted"> / {period}</span>
              </div>
              {settings.lemonsqueezy_enabled && <div className="text-sm text-muted">or ${settings.price_usd} internationally</div>}
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {PRO_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-brand" />{f}</li>)}
              </ul>
              <div className="mt-6">
                <PayButtons
                  razorpay={settings.razorpay_enabled}
                  lemon={settings.lemonsqueezy_enabled}
                  priceInr={settings.price_inr}
                  priceUsd={Number(settings.price_usd)}
                  period={period}
                  email={profile.email}
                  name={profile.full_name}
                  appName={env.appName()}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
