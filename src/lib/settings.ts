import { db } from "./supabase";
import type { AppSettings, Profile } from "./types";

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await db().from("app_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return data as AppSettings;
}

// Pro only counts while paid_until is in the future (or for lifetime / admin-granted).
export function effectivePlan(profile: Profile): "free" | "pro" {
  if (profile.role === "admin") return "pro";
  if (profile.plan !== "pro") return "free";
  if (!profile.paid_until) return "pro"; // lifetime or granted by admin
  return new Date(profile.paid_until) > new Date() ? "pro" : "free";
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
