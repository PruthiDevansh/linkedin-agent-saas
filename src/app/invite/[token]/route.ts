import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/session";
import { db } from "@/lib/supabase";

// Accepts a team invite. The invite email must match the signed-in account.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const profile = await currentProfile();
  if (!profile) return to(`/login?next=${encodeURIComponent(`/invite/${token}`)}&ok=${encodeURIComponent("Log in or create an account to accept the invite.")}`);

  const { data: invite } = await db().from("workspace_invites").select("*, workspaces(name)").eq("token", token).is("accepted_at", null).maybeSingle();
  if (!invite) return to(`/app?error=${encodeURIComponent("This invite is invalid or was already used.")}`);
  if (invite.email.toLowerCase() !== profile.email.toLowerCase()) {
    return to(`/app?error=${encodeURIComponent(`This invite is for ${invite.email}. You're logged in as ${profile.email}.`)}`);
  }

  await db().from("workspace_members").upsert({ workspace_id: invite.workspace_id, user_id: profile.id, role: invite.role });
  await db().from("workspace_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  const name = (invite.workspaces as { name?: string } | null)?.name ?? "the workspace";
  const res = to(`/app?ok=${encodeURIComponent(`You joined ${name}.`)}`);
  res.cookies.set("ws", invite.workspace_id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
