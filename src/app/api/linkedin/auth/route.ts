import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { signToken } from "@/lib/crypto";
import { authorizationUrl } from "@/lib/engine/linkedin";
import { currentProfile } from "@/lib/session";
import { db } from "@/lib/supabase";

// Starts "Connect LinkedIn" for a workspace the user can edit.
export async function GET(request: Request) {
  const back = (msg: string) => NextResponse.redirect(new URL(`/app/accounts?error=${encodeURIComponent(msg)}`, request.url));
  const profile = await currentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));

  const ws = new URL(request.url).searchParams.get("ws") ?? profile.default_workspace_id ?? "";
  const { data: member } = await db().from("workspace_members").select("role").eq("workspace_id", ws).eq("user_id", profile.id).maybeSingle();
  if (!member || member.role === "viewer") return back("You can't connect accounts to this workspace.");

  // The plan's account limit is checked in the callback, where we know whether
  // this is a new LinkedIn profile or a reconnect of an existing one.

  // CSRF: the state is signed and bound to a random cookie in this browser.
  const nonce = randomBytes(16).toString("hex");
  const state = signToken({ ws, uid: profile.id, nonce }, 600);
  const res = NextResponse.redirect(authorizationUrl(state));
  res.cookies.set("li_nonce", nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/linkedin", maxAge: 600 });
  return res;
}
