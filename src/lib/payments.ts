import { createHmac } from "node:crypto";
import { env, secretMatches } from "./env";
import { getSettings } from "./settings";
import { db } from "./supabase";

// Marks a payment paid (once) and extends the user's Pro access.
export async function activatePro(userId: string, provider: "razorpay" | "lemonsqueezy" | "manual", ref: string, amount: number, currency: string, raw: unknown) {
  const { data: existing } = await db().from("payments").select("status").eq("provider", provider).eq("provider_ref", ref).maybeSingle();
  if (existing?.status === "paid") return; // webhook + client confirm can both arrive: process once

  await db().from("payments").upsert(
    { user_id: userId, provider, provider_ref: ref, amount, currency, status: "paid", raw },
    { onConflict: "provider,provider_ref" },
  );

  const settings = await getSettings();
  const { data: profile } = await db().from("profiles").select("paid_until").eq("id", userId).single();
  let paidUntil: string | null = null;
  if (settings.billing_period_days > 0) {
    const base = profile?.paid_until && new Date(profile.paid_until) > new Date() ? new Date(profile.paid_until) : new Date();
    paidUntil = new Date(base.getTime() + settings.billing_period_days * 86_400_000).toISOString();
  }
  await db().from("profiles").update({ plan: "pro", status: "active", paid_until: paidUntil }).eq("id", userId);
  await db().from("usage_events").insert({ user_id: userId, type: "payment", meta: { provider, amount, currency } });
}

// ------------------------------------------------------------------ Razorpay

function razorpayAuth() {
  return `Basic ${Buffer.from(`${env.razorpayKeyId()}:${env.razorpayKeySecret()}`).toString("base64")}`;
}

export async function createRazorpayOrder(userId: string) {
  const settings = await getSettings();
  if (!settings.razorpay_enabled || !env.razorpayKeyId()) throw new Error("Razorpay is not enabled.");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: settings.price_inr * 100, currency: "INR", receipt: `u_${userId.slice(0, 30)}`, notes: { user_id: userId } }),
  });
  const order = (await res.json()) as { id?: string; amount?: number; error?: { description?: string } };
  if (!order.id) throw new Error(`Razorpay order failed: ${order.error?.description ?? res.status}`);
  await db().from("payments").insert({ user_id: userId, provider: "razorpay", provider_ref: order.id, amount: settings.price_inr, currency: "INR", status: "created" });
  return { orderId: order.id, amount: order.amount!, keyId: env.razorpayKeyId() };
}

// Checkout returns order id + payment id + signature = HMAC(order_id|payment_id).
export function verifyRazorpayCheckout(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", env.razorpayKeySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return secretMatches(signature, expected);
}

export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  if (!env.razorpayWebhookSecret()) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret()).update(rawBody).digest("hex");
  return secretMatches(signature, expected);
}

// ------------------------------------------------------------------ Lemon Squeezy

export async function createLemonCheckout(userId: string, email: string) {
  const settings = await getSettings();
  if (!settings.lemonsqueezy_enabled || !env.lemonApiKey()) throw new Error("Lemon Squeezy is not enabled.");
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.lemonApiKey()}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: Math.round(Number(settings.price_usd) * 100),
          checkout_data: { email, custom: { user_id: userId } },
          product_options: { redirect_url: `${env.appUrl()}/app?paid=1` },
        },
        relationships: {
          store: { data: { type: "stores", id: env.lemonStoreId() } },
          variant: { data: { type: "variants", id: env.lemonVariantId() } },
        },
      },
    }),
  });
  const data = (await res.json()) as { data?: { attributes?: { url?: string } }; errors?: { detail?: string }[] };
  const url = data.data?.attributes?.url;
  if (!url) throw new Error(`Lemon Squeezy checkout failed: ${data.errors?.[0]?.detail ?? res.status}`);
  return url;
}

export function verifyLemonWebhook(rawBody: string, signature: string | null): boolean {
  if (!env.lemonWebhookSecret()) return false;
  const expected = createHmac("sha256", env.lemonWebhookSecret()).update(rawBody).digest("hex");
  return secretMatches(signature, expected);
}
