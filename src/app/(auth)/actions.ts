"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { authClient } from "@/lib/supabase";

const back = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export async function signIn(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("/login", { error: error.message === "Invalid login credentials" ? "Wrong email or password." : error.message, email });
  redirect(safeNext(form.get("next")));
}

export async function signUp(form: FormData) {
  const fullName = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) back("/register", { error: "Use at least 8 characters for your password.", email, full_name: fullName });

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${env.appUrl()}/auth/callback?next=/onboarding` },
  });
  if (error) back("/register", { error: error.message, email, full_name: fullName });
  // With email confirmation on, there is no session yet.
  if (!data.session) back("/login", { ok: "Check your email and click the link to confirm your account." });
  redirect("/onboarding");
}

export async function resetPassword(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const supabase = await authClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent("/app/settings?reset=1#password")}` });
  back("/login", { ok: "If that email has an account, a reset link is on its way." });
}

// Used from Settings, and after clicking a password-reset email link (which signs you in).
export async function changePassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) back("/app/settings", { error: "Use at least 8 characters for your new password." });
  if (password !== confirm) back("/app/settings", { error: "The two passwords don't match." });
  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back("/app/settings", { error: error.message });
  back("/app/settings", { ok: "Password changed." });
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
