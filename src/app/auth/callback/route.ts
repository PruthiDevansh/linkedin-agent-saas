import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase";

// Email confirmation and password-reset links land here with a one-time code.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const supabase = await authClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safe, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=That+link+is+invalid+or+expired.", url.origin));
}
