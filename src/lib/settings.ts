import { cache } from "react";
import { env } from "./env";
import { db } from "./supabase";
import type { AppSettings, Profile } from "./types";

// Cached per request: the layout and page both read settings.
export const getSettings = cache(async (): Promise<AppSettings> => {
  const { data, error } = await db().from("app_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return data as AppSettings;
});

// Pro only counts while paid_until is in the future (or for lifetime / admin-granted).
export function effectivePlan(profile: Profile): "free" | "pro" {
  if (profile.role === "admin") return "pro";
  if (profile.plan !== "pro") return "free";
  if (!profile.paid_until) return "pro"; // lifetime or granted by admin
  return new Date(profile.paid_until) > new Date() ? "pro" : "free";
}

// Posts are written with the platform Gemini key: Pro, switched on by the admin
// for this user, or switched on for every free user.
export function usesPlatformAi(settings: AppSettings, profile: Profile): boolean {
  if (!env.geminiKey()) return false;
  return effectivePlan(profile) === "pro" || !!profile.platform_ai || !!settings.free_platform_ai;
}

// True when the user can't generate anything until they add their own key.
export function needsOwnKey(settings: AppSettings, profile: Profile): boolean {
  return !usesPlatformAi(settings, profile) && !profile.gemini_key_enc;
}

export function dailyDraftLimit(settings: AppSettings, profile: Profile): number {
  return effectivePlan(profile) === "pro" ? settings.pro_daily_drafts : settings.free_daily_drafts;
}

export function maxAccounts(settings: AppSettings, profile: Profile): number {
  return effectivePlan(profile) === "pro" ? settings.pro_max_accounts : settings.free_max_accounts;
}

export function periodLabel(days: number): string {
  if (days === 0) return "lifetime";
  if (days === 30) return "month";
  if (days === 365) return "year";
  return `${days} days`;
}
