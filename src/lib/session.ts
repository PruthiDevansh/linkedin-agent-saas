import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "./env";
import { getSettings } from "./settings";
import { authClient, db } from "./supabase";
import type { MemberRole, Profile, Workspace } from "./types";

// Creates the profile + first workspace the first time a user signs in.
async function createProfile(id: string, email: string, fullName: string): Promise<Profile> {
  const settings = await getSettings();
  const isAdmin = env.adminEmails().includes(email.toLowerCase());
  const status = isAdmin || settings.registration_mode !== "paid" ? "active" : "pending_payment";

  const { data: profile, error } = await db()
    .from("profiles")
    .insert({ id, email, full_name: fullName, role: isAdmin ? "admin" : "user", plan: isAdmin ? "pro" : "free", status })
    .select()
    .single();
  if (error) throw new Error(`Could not create profile: ${error.message}`);

  const { data: ws, error: wsError } = await db()
    .from("workspaces")
    .insert({ owner_id: id, name: fullName ? `${fullName.split(" ")[0]}'s workspace` : "My workspace" })
    .select()
    .single();
  if (wsError) throw new Error(`Could not create workspace: ${wsError.message}`);

  await db().from("workspace_members").insert({ workspace_id: ws.id, user_id: id, role: "owner" });
  await db().from("profiles").update({ default_workspace_id: ws.id }).eq("id", id);
  await db().from("usage_events").insert({ user_id: id, workspace_id: ws.id, type: "registered" });
  return { ...(profile as Profile), default_workspace_id: ws.id };
}

// The signed-in user's profile, or null. Cached per request.
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;

  const { data: existing } = await db().from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing) {
    // Track activity at most every 10 minutes.
    if (Date.now() - new Date(existing.last_active_at).getTime() > 10 * 60_000) {
      await db().from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", user.id);
    }
    return existing as Profile;
  }
  return createProfile(user.id, user.email, (user.user_metadata?.full_name as string) ?? "");
});

export async function requireUser(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.status === "suspended") redirect("/suspended");
  return profile;
}

// For pages that need an active (paid if required) account.
export async function requireActiveUser(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.status === "pending_payment") redirect("/onboarding");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/app");
  return profile;
}

export type WorkspaceContext = { workspace: Workspace; role: MemberRole; workspaces: { id: string; name: string; role: MemberRole }[] };

// The workspace the user is working in, plus the list they can switch to.
export async function currentWorkspace(profile: Profile, requested?: string): Promise<WorkspaceContext> {
  const { data: memberships } = await db()
    .from("workspace_members")
    .select("role, workspaces(id, name)")
    .eq("user_id", profile.id);

  const list = (memberships ?? []).map((m) => {
    const w = m.workspaces as unknown as { id: string; name: string };
    return { id: w.id, name: w.name, role: m.role as MemberRole };
  });
  const chosen = list.find((w) => w.id === requested) ?? list.find((w) => w.id === profile.default_workspace_id) ?? list[0];
  if (!chosen) throw new Error("You are not a member of any workspace.");

  const { data: workspace } = await db().from("workspaces").select("*").eq("id", chosen.id).single();
  return { workspace: workspace as Workspace, role: chosen.role, workspaces: list };
}

export function canEdit(role: MemberRole) {
  return role === "owner" || role === "editor";
}
