import { Gift } from "lucide-react";
import Link from "next/link";
import { Button, Flash, Input, Label, Notice } from "@/components/ui";
import { db } from "@/lib/supabase";
import type { AdminInvite } from "@/lib/types";
import { signUp } from "../actions";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const { data: invite } = params.invite
    ? await db().from("admin_invites").select("*").eq("token", params.invite).is("accepted_at", null).maybeSingle<AdminInvite>()
    : { data: null };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{invite ? "You're invited" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted">Your first AI draft is about 2 minutes away.</p>
      <div className="mt-6">
        <Flash searchParams={params} />
        {invite && (
          <div className="mb-4">
            <Notice tone="success">
              <span className="inline-flex items-start gap-2">
                <Gift className="mt-0.5 size-4 shrink-0" />
                <span>
                  Your account comes with {invite.plan === "pro" ? <b>Pro{invite.pro_days ? ` for ${invite.pro_days} days` : " (lifetime)"}</b> : <b>free access</b>}
                  {invite.platform_ai && <> and <b>built-in AI</b>: no API key needed</>}.
                </span>
              </span>
            </Notice>
          </div>
        )}
        <form action={signUp} className="space-y-4">
          {invite && <input type="hidden" name="invite" value={invite.token} />}
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required defaultValue={params.full_name} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={params.email ?? invite?.email} readOnly={!!invite} />
          </div>
          <div>
            <Label htmlFor="password" hint="(8+ characters)">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <Button type="submit" className="w-full" pending="Creating your account…">Create account</Button>
        </form>
        <p className="mt-4 text-xs text-muted">By signing up you agree to our terms and privacy policy.</p>
        <p className="mt-8 text-sm text-muted">
          Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
        </p>
      </div>
    </>
  );
}
