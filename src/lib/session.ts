import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { env } from "./env";
import { getSettings } from "./settings";
import { authClient, db } from "./supabase";
import type { AdminInvite, MemberRole, Profile, Workspace } from "./types";

// Set by an admin to use the app as another user (see "View as" in the admin panel).
export const IMPERSONATE_COOKIE = "imp";

// The newest unused admin invite for this email, if any.
export async function pendingInvite(email: string): Promise<AdminInvite | null> {
  const { data } = await db()
    .from("admin_invites")
    .select("*")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AdminInvite | null) ?? null;
}

// What an invite grants, as profile columns.
export function inviteGrant(invite: AdminInvite) {
  return {
    status: "active" as const,
    plan: invite.plan,
    paid_until: invite.plan === "pro" && invite.pro_days ? new Date(Date.now() + invite.pro_days * 86_400_000).toISOString() : null,
    platform_ai: invite.platform_ai,
  };
}

// Creates the profile + first workspace the first time a user signs in.
async function createProfile(id: string, email: string, fullName: string): Promise<Profile> {
  const [settings, invite] = await Promise.all([getSettings(), pendingInvite(email)]);
  const isAdmin = env.adminEmails().includes(email.toLowerCase());
  const status = isAdmin || invite || settings.registration_mode !== "paid" ? "active" : "pending_payment";

  const { data: profile, error } = await db()
    .from("profiles")
    .insert({
      id,
      email,
      full_name: fullName,
      role: isAdmin ? "admin" : "user",
      plan: isAdmin ? "pro" : "free",
      status,
      ...(invite && !isAdmin ? inviteGrant(invite) : {}),
    })
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
  await db().from("usage_events").insert({ user_id: id, workspace_id: ws.id, type: "registered", meta: invite ? { invited: invite.plan } : {} });
  if (invite) await db().from("admin_invites").update({ accepted_at: new Date().toISOString(), accepted_by: id }).eq("id", invite.id);
  return { ...(profile as Profile), default_workspace_id: ws.id };
}

// The person actually logged in (never the impersonated user). Cached per request.
const sessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await authClient();
  // Verified locally from the signed login token: no extra network round trip.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = claims?.sub;
  const email = typeof claims?.email === "string" ? claims.email : "";
  if (!id || !email) return null;

  const { data: existing } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  if (existing) {
    // Track activity at most every 10 minutes, after the response is sent.
    if (Date.now() - new Date(existing.last_active_at).getTime() > 10 * 60_000) {
      after(() => db().from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", id));
    }
    return existing as Profile;
  }
  const meta = (claims?.user_metadata ?? {}) as { full_name?: string };
  return createProfile(id, email, meta.full_name ?? "");
});

// When an admin is viewing the app as someone else: both profiles. Only honoured
// for a logged-in admin, so the cookie is useless to anyone else.
export const impersonation = cache(async (): Promise<{ admin: Profile; target: Profile } | null> => {
  const targetId = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
  if (!targetId) return null;
  const admin = await sessionProfile();
  if (!admin || admin.role !== "admin" || admin.id === targetId) return null;
  const { data } = await db().from("profiles").select("*").eq("id", targetId).maybeSingle();
  return data ? { admin, target: data as Profile } : null;
});

// The profile the app acts as: the signed-in user, or the user an admin is viewing as.
export const currentProfile = cache(async (): Promise<Profile | null> => (await impersonation())?.target ?? sessionProfile());

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

// Checks the real signed-in account, so the admin panel keeps working while viewing as someone.
export async function requireAdmin(): Promise<Profile> {
  const profile = await sessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" || profile.status === "suspended") redirect("/app");
  return profile;
}

export type WorkspaceContext = { workspace: Workspace; role: MemberRole; workspaces: { id: string; name: string; role: MemberRole }[] };

// The workspace the user is working in, plus the list they can switch to.
// One query, and cached so the layout and the page share it per request.
export const currentWorkspace = cache(async (profile: Profile, requested?: string): Promise<WorkspaceContext> => {
  const { data: memberships } = await db().from("workspace_members").select("role, workspaces(*)").eq("user_id", profile.id);

  const rows = (memberships ?? []).map((m) => ({ workspace: m.workspaces as unknown as Workspace, role: m.role as MemberRole }));
  const chosen =
    rows.find((r) => r.workspace.id === requested) ?? rows.find((r) => r.workspace.id === profile.default_workspace_id) ?? rows[0];
  if (!chosen) throw new Error("You are not a member of any workspace.");

  return {
    workspace: chosen.workspace,
    role: chosen.role,
    workspaces: rows.map((r) => ({ id: r.workspace.id, name: r.workspace.name, role: r.role })),
  };
});

export function canEdit(role: MemberRole) {
  return role === "owner" || role === "editor";
}
