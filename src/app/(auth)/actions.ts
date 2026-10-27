"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { IMPERSONATE_COOKIE, impersonation, pendingInvite } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { authClient, db } from "@/lib/supabase";

const back = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

const isRateLimited = (e: AuthError) => e.code === "over_email_send_rate_limit" || e.status === 429 || /rate limit/i.test(e.message);
const RATE_LIMITED = "Too many emails were sent in the last hour, so we couldn't send another one. Please try again in a few minutes, or ask the admin to confirm your account.";

// Plain-English versions of Supabase auth errors.
function friendly(e: AuthError): string {
  if (isRateLimited(e)) return RATE_LIMITED;
  if (e.code === "email_exists" || e.code === "user_already_exists" || /already (been )?registered/i.test(e.message)) return "An account with this email already exists. Log in instead.";
  if (e.code === "weak_password") return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  if (e.code === "email_not_confirmed") return "Your email isn't confirmed yet. Click the link we emailed you, or ask the admin to confirm your account.";
  if (e.message === "Invalid login credentials") return "Wrong email or password.";
  return e.message;
}

// Confirms an account without sending any email (the password was already checked).
async function confirmByEmail(email: string): Promise<boolean> {
  const { data } = await db().auth.admin.generateLink({ type: "magiclink", email });
  if (!data?.user) return false;
  const { error } = await db().auth.admin.updateUserById(data.user.id, { email_confirm: true });
  return !error;
}

export async function signIn(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const supabase = await authClient();
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  // Signed up while confirmation emails were rate limited? When the admin doesn't require
  // email confirmation, confirm them now (Supabase checks the password before this error).
  if (error?.code === "email_not_confirmed" && !(await getSettings()).require_email_confirm && (await confirmByEmail(email))) {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) back("/login", { error: friendly(error), email });
  redirect(safeNext(form.get("next")));
}

export async function signUp(form: FormData) {
  const fullName = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const inviteToken = String(form.get("invite") ?? "");
  const retry = { email, full_name: fullName, ...(inviteToken ? { invite: inviteToken } : {}) };
  if (!/^\S+@\S+\.\S+$/.test(email)) back("/register", { error: "Enter a valid email address.", ...retry });
  if (password.length < 8) back("/register", { error: "Use at least 8 characters for your password.", ...retry });

  const supabase = await authClient();
  const [settings, invite] = await Promise.all([getSettings(), pendingInvite(email)]);
  // People the admin invited are already vouched for: no confirmation email.
  const invited = !!invite && invite.token === inviteToken;

  if (!settings.require_email_confirm || invited) {
    // No confirmation email: create the account already confirmed, then log in.
    // This avoids Supabase's hourly email limit entirely.
    const { error } = await db().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) back("/register", { error: friendly(error), ...retry });
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) back("/login", { error: friendly(loginError), email });
    redirect("/onboarding");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${env.appUrl()}/auth/callback?next=/onboarding` },
  });
  if (error && isRateLimited(error)) {
    // The confirmation email couldn't be sent (hourly limit). Rather than leave them
    // stuck, create the account confirmed (or confirm the half-made one) and log in.
    const { error: createError } = await db().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (!createError || (await confirmByEmail(email))) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginError) redirect("/onboarding");
    }
  }
  if (error) back("/register", { error: friendly(error), ...retry });
  // With email confirmation on, there is no session yet.
  if (!data.session) back("/login", { ok: "Check your email and click the link to confirm your account." });
  redirect("/onboarding");
}

export async function resetPassword(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const supabase = await authClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent("/app/settings?reset=1#password")}` });
  if (error && isRateLimited(error)) back("/login", { error: RATE_LIMITED, email });
  back("/login", { ok: "If that email has an account, a reset link is on its way." });
}

// Used from Settings, and after clicking a password-reset email link (which signs you in).
export async function changePassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) back("/app/settings", { error: "Use at least 8 characters for your new password." });
  if (password !== confirm) back("/app/settings", { error: "The two passwords don't match." });
  if (await impersonation()) back("/app/settings", { error: "You are viewing as another user. Set their password from the admin panel instead." });
  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back("/app/settings", { error: friendly(error) });
  back("/app/settings", { ok: "Password changed." });
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/login");
}
