"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerTelegramWebhook } from "@/lib/channels/telegram";
import { ensureSchedule } from "@/lib/engine/scheduler";
import { activatePro } from "@/lib/payments";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";

const go = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function saveAppSettings(form: FormData) {
  await requireAdmin();
  const mode = String(form.get("registration_mode"));
  const int = (k: string, min = 0) => Math.max(min, Math.floor(Number(form.get(k) ?? 0)) || 0);
  const { error } = await db()
    .from("app_settings")
    .update({
      registration_mode: ["free_byok", "paid", "both"].includes(mode) ? mode : "free_byok",
      price_inr: int("price_inr", 1),
      price_usd: Math.max(1, Number(form.get("price_usd") ?? 9) || 9),
      billing_period_days: int("billing_period_days"),
      razorpay_enabled: form.get("razorpay_enabled") === "on",
      lemonsqueezy_enabled: form.get("lemonsqueezy_enabled") === "on",
      free_daily_drafts: int("free_daily_drafts"),
      pro_daily_drafts: int("pro_daily_drafts", 1),
      free_max_accounts: int("free_max_accounts", 1),
      pro_max_accounts: int("pro_max_accounts", 1),
      announcement: String(form.get("announcement") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) go("/admin/settings", { error: error.message });
  revalidatePath("/", "layout");
  go("/admin/settings", { ok: "Settings saved. They apply immediately." });
}

export async function updateUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  const action = String(form.get("action"));
  const back = `/admin/users/${id}`;
  if (id === admin.id && ["suspend", "demote"].includes(action)) go(back, { error: "You can't do that to your own account." });

  const updates: Record<string, Record<string, unknown>> = {
    activate: { status: "active" },
    suspend: { status: "suspended" },
    free: { plan: "free", paid_until: null },
    promote: { role: "admin" },
    demote: { role: "user" },
    lifetime: { plan: "pro", paid_until: null, status: "active" },
  };
  if (action === "grant") {
    const days = Math.max(1, Math.floor(Number(form.get("days") ?? 30)));
    const { data: p } = await db().from("profiles").select("paid_until").eq("id", id).single();
    const base = p?.paid_until && new Date(p.paid_until) > new Date() ? new Date(p.paid_until) : new Date();
    await db().from("profiles").update({ plan: "pro", status: "active", paid_until: new Date(base.getTime() + days * 86_400_000).toISOString() }).eq("id", id);
  } else if (action === "manual_payment") {
    const amount = Number(form.get("amount") ?? 0);
    await activatePro(id, "manual", `manual-${Date.now()}`, amount, String(form.get("currency") ?? "INR"), { by: admin.email });
  } else if (updates[action]) {
    await db().from("profiles").update(updates[action]).eq("id", id);
  } else {
    go(back, { error: "Unknown action." });
  }
  await db().from("usage_events").insert({ user_id: id, type: "admin_action", meta: { action, by: admin.email } });
  go(back, { ok: "Updated." });
}

export async function addLibraryItem(form: FormData) {
  const admin = await requireAdmin();
  const kind = String(form.get("kind"));
  const title = String(form.get("title") ?? "").trim();
  if (!title) go("/admin/library", { error: "Title is required." });
  await db().from("inspiration_items").insert({
    kind: ["hook", "template", "curated"].includes(kind) ? kind : "curated",
    category: String(form.get("category") ?? "general").trim() || "general",
    title: title.slice(0, 200),
    body: String(form.get("body") ?? "").slice(0, 3000),
    source_url: String(form.get("source_url") ?? "").trim() || null,
    created_by: admin.id,
  });
  go("/admin/library", { ok: "Added to the library." });
}

export async function deleteLibraryItem(form: FormData) {
  await requireAdmin();
  await db().from("inspiration_items").delete().eq("id", String(form.get("id")));
  go("/admin/library", { ok: "Removed." });
}

export async function setupTelegram() {
  await requireAdmin();
  try {
    const url = await registerTelegramWebhook();
    go("/admin/settings", { ok: `Telegram bot connected to ${url}` });
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    go("/admin/settings", { error: err instanceof Error ? err.message : "Telegram setup failed." });
  }
}

export async function setupScheduler() {
  await requireAdmin();
  try {
    const result = await ensureSchedule();
    go("/admin/settings", { ok: result === "created" ? "Scheduler started: runs every 15 minutes." : "Scheduler is already running." });
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    go("/admin/settings", { error: err instanceof Error ? err.message : "Scheduler setup failed." });
  }
}
