import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encrypt, verifyToken } from "@/lib/crypto";
import { logUsage } from "@/lib/engine/drafts";
import { exchangeCode } from "@/lib/engine/linkedin";
import { getSettings, maxAccounts } from "@/lib/settings";
import { db } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (key: "ok" | "error", msg: string) => NextResponse.redirect(new URL(`/app/accounts?${key}=${encodeURIComponent(msg)}`, request.url));
  if (url.searchParams.get("error")) return back("error", "LinkedIn connection was cancelled.");

  const state = verifyToken<{ ws: string; uid: string; nonce: string }>(url.searchParams.get("state") ?? "");
  const nonce = (await cookies()).get("li_nonce")?.value;
  if (!state || !nonce || state.nonce !== nonce) return back("error", "This connection link expired. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return back("error", "LinkedIn didn't return a login code.");

  try {
    const li = await exchangeCode(code);
    const { data: existing } = await db().from("linkedin_accounts").select("id").eq("workspace_id", state.ws).eq("person_urn", li.personUrn).maybeSingle();
    if (!existing) {
      const { data: profile } = await db().from("profiles").select("*").eq("id", state.uid).single();
      const { count } = await db().from("linkedin_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", state.ws);
      const limit = maxAccounts(await getSettings(), profile as Profile);
      if ((count ?? 0) >= limit) return back("error", `Your plan allows ${limit} LinkedIn account(s) per workspace. Upgrade for more.`);
    }
    await db()
      .from("linkedin_accounts")
      .upsert(
        { workspace_id: state.ws, connected_by: state.uid, name: li.name, person_urn: li.personUrn, access_token_enc: encrypt(li.accessToken), expires_at: li.expiresAt.toISOString() },
        { onConflict: "workspace_id,person_urn" },
      );
    await logUsage(state.uid, state.ws, "linkedin_connected");
    const res = back("ok", `LinkedIn connected as ${li.name || "you"}. Valid for 60 days.`);
    res.cookies.delete({ name: "li_nonce", path: "/api/linkedin" });
    return res;
  } catch (err) {
    console.error("LinkedIn callback failed:", err);
    return back("error", err instanceof Error ? err.message : "LinkedIn connection failed.");
  }
}
