import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase";

// Email confirmation and password-reset links land here with a one-time code,
// or with a token hash (links an admin generates in the admin panel).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/app";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code || (tokenHash && type)) {
    const supabase = await authClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
    if (!error) return NextResponse.redirect(new URL(safe, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=That+link+is+invalid+or+expired.", url.origin));
}
