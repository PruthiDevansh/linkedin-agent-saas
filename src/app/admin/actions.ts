"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { registerTelegramWebhook } from "@/lib/channels/telegram";
import { ensureSchedule } from "@/lib/engine/scheduler";
import { env } from "@/lib/env";
import { activatePro } from "@/lib/payments";
import { IMPERSONATE_COOKIE, inviteGrant, requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { AdminInvite } from "@/lib/types";

const go = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function saveAppSettings(form: FormData) {
  await requireAdmin();
  const mode = String(form.get("registration_mode"));
  const int = (k: string, min = 0) => Math.max(min, Math.floor(Number(form.get(k) ?? 0)) || 0);
  const newer = {
    require_email_confirm: form.get("require_email_confirm") === "on",
    free_platform_ai: form.get("free_platform_ai") === "on",
  };
  const base = {
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
  };
  let { error } = await db().from("app_settings").update({ ...base, ...newer }).eq("id", 1);
  // Database not upgraded yet: still save everything else.
  const oldSchema = !!error && needsMigration(error.message);
  if (oldSchema) ({ error } = await db().from("app_settings").update(base).eq("id", 1));
  if (error) go("/admin/settings", { error: error.message });
  revalidatePath("/", "layout");
  if (oldSchema) go("/admin/settings", { error: `Saved, except the sign-up and AI switches. ${MIGRATION_HINT}` });
  go("/admin/settings", { ok: "Settings saved. They apply immediately." });
}

// Where to return after an action: the page it was clicked on, if it's an admin page.
function backTo(form: FormData, fallback: string) {
  const back = String(form.get("back") ?? "");
  return back.startsWith("/admin") ? back : fallback;
}

const MESSAGES: Record<string, string> = {
  activate: "Account activated.",
  suspend: "Account suspended. They can't use the app until you activate it.",
  free: "Moved to the Free plan.",
  lifetime: "Pro switched on (no end date).",
  promote: "They're now an admin.",
  demote: "Admin access removed.",
  ai_on: "Built-in AI switched on: they can write posts without their own key.",
  ai_off: "Built-in AI switched off: they need their own Gemini key (unless Pro).",
  grant: "Pro days added.",
  manual_payment: "Payment recorded and Pro activated.",
  confirm_email: "Email confirmed. They can log in now.",
};

export async function updateUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  const action = String(form.get("action"));
  const back = backTo(form, `/admin/users/${id}`);
  if (id === admin.id && ["suspend", "demote"].includes(action)) go(back, { error: "You can't do that to your own account." });

  const updates: Record<string, Record<string, unknown>> = {
    activate: { status: "active" },
    suspend: { status: "suspended" },
    free: { plan: "free", paid_until: null },
    promote: { role: "admin" },
    demote: { role: "user" },
    lifetime: { plan: "pro", paid_until: null, status: "active" },
    ai_on: { platform_ai: true },
    ai_off: { platform_ai: false },
  };
  let failed: string | undefined;
  if (action === "grant") {
    const days = Math.max(1, Math.floor(Number(form.get("days") ?? 30)));
    const { data: p } = await db().from("profiles").select("paid_until").eq("id", id).single();
    const base = p?.paid_until && new Date(p.paid_until) > new Date() ? new Date(p.paid_until) : new Date();
    const paid_until = new Date(base.getTime() + days * 86_400_000).toISOString();
    failed = (await db().from("profiles").update({ plan: "pro", status: "active", paid_until }).eq("id", id)).error?.message;
  } else if (action === "manual_payment") {
    const amount = Number(form.get("amount") ?? 0);
    await activatePro(id, "manual", `manual-${Date.now()}`, amount, String(form.get("currency") ?? "INR"), { by: admin.email });
  } else if (action === "confirm_email") {
    failed = (await db().auth.admin.updateUserById(id, { email_confirm: true })).error?.message;
  } else if (updates[action]) {
    failed = (await db().from("profiles").update(updates[action]).eq("id", id)).error?.message;
  } else {
    go(back, { error: "Unknown action." });
  }
  if (failed) go(back, { error: needsMigration(failed) ? MIGRATION_HINT : failed });
  await db().from("usage_events").insert({ user_id: id, type: "admin_action", meta: { action, by: admin.email } });
  revalidatePath("/admin", "layout");
  go(back, { ok: MESSAGES[action] ?? "Updated." });
}

const needsMigration = (message: string) => /platform_ai|require_email_confirm|free_platform_ai|admin_invites|schema cache/i.test(message);
const MIGRATION_HINT = "This needs the new database columns. Run supabase/migrations/0002_admin.sql in the Supabase SQL Editor, then try again.";

export async function setUserPassword(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  const password = String(form.get("password") ?? "");
  const back = `/admin/users/${id}`;
  if (password.length < 8) go(back, { error: "Use at least 8 characters." });
  const { error } = await db().auth.admin.updateUserById(id, { password, email_confirm: true });
  if (error) go(back, { error: error.message });
  await db().from("usage_events").insert({ user_id: id, type: "admin_action", meta: { action: "set_password", by: admin.email } });
  go(back, { ok: "Password set. Share it with them privately; they can change it in Settings." });
}

export type LinkState = { link?: string; error?: string };

// A one-time login link to reset the password, made without sending any email.
export async function generateResetLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  const { data: user } = await db().from("profiles").select("email").eq("id", id).maybeSingle();
  if (!user) return { error: "User not found." };
  const { data, error } = await db().auth.admin.generateLink({ type: "recovery", email: user.email });
  if (error || !data.properties?.hashed_token) return { error: error?.message ?? "Could not create a link." };
  await db().from("usage_events").insert({ user_id: id, type: "admin_action", meta: { action: "reset_link", by: admin.email } });
  const next = encodeURIComponent("/app/settings?reset=1#password");
  return { link: `${env.appUrl()}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=${next}` };
}

export async function deleteUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  if (id === admin.id) go(`/admin/users/${id}`, { error: "You can't delete your own account." });
  const { data: user } = await db().from("profiles").select("email").eq("id", id).maybeSingle();
  // Removes the login; the profile, workspaces and posts go with it.
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) go(`/admin/users/${id}`, { error: error.message });
  await db().from("usage_events").insert({ type: "admin_action", meta: { action: "delete_user", email: user?.email, by: admin.email } });
  revalidatePath("/admin", "layout");
  go("/admin/users", { ok: `Deleted ${user?.email ?? "the user"}.` });
}

// ---------------------------------------------------------------- view as user

export async function startImpersonating(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  if (id === admin.id) go(`/admin/users/${id}`, { error: "That's you." });
  const { data: user } = await db().from("profiles").select("email, full_name").eq("id", id).maybeSingle();
  if (!user) go("/admin/users", { error: "User not found." });
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  store.delete("ws");
  await db().from("usage_events").insert({ user_id: id, type: "admin_view_as", meta: { by: admin.email } });
  go("/app", { ok: `You're now viewing as ${user!.full_name || user!.email}. Use "Exit to admin" at the top when done.` });
}

export async function stopImpersonating() {
  const store = await cookies();
  const id = store.get(IMPERSONATE_COOKIE)?.value;
  store.delete(IMPERSONATE_COOKIE);
  store.delete("ws");
  go(id ? `/admin/users/${id}` : "/admin", { ok: "Back to your admin account." });
}

// ---------------------------------------------------------------- invites

export async function createInvite(form: FormData) {
  const admin = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) go("/admin/invites", { error: "Enter a valid email address." });
  const plan = form.get("plan") === "pro" ? "pro" : "free";
  const days = Math.floor(Number(form.get("pro_days") ?? 0));
  const invite: Partial<AdminInvite> = {
    email,
    token: randomBytes(18).toString("base64url"),
    plan,
    pro_days: plan === "pro" && days > 0 ? days : null,
    platform_ai: form.get("platform_ai") === "on",
    note: String(form.get("note") ?? "").trim().slice(0, 200) || null,
    created_by: admin.id,
  };

  // Already has an account: give them the access right away.
  const { data: existing } = await db().from("profiles").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (existing) Object.assign(invite, { accepted_at: new Date().toISOString(), accepted_by: existing.id });
  const { data: row, error } = await db()
    .from("admin_invites")
    .insert(invite)
    .select()
    .single();
  if (error) go("/admin/invites", { error: needsMigration(error.message) ? MIGRATION_HINT : error.message });
  if (existing) {
    await db().from("profiles").update(inviteGrant(row as AdminInvite)).eq("id", existing.id);
    await db().from("usage_events").insert({ user_id: existing.id, type: "admin_action", meta: { action: "invite_applied", by: admin.email } });
    go("/admin/invites", { ok: `${email} already has an account, so their access was updated now.` });
  }
  go("/admin/invites", { ok: `Invite created for ${email}. Copy the link and send it to them.` });
}

export async function revokeInvite(form: FormData) {
  await requireAdmin();
  await db().from("admin_invites").delete().eq("id", String(form.get("id"))).is("accepted_at", null);
  go("/admin/invites", { ok: "Invite revoked. The link no longer works." });
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
