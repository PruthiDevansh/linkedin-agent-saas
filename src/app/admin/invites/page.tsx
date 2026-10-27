import { Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit";
import { Badge, Card, CardHeader, Empty, Flash, Input, Label, Notice, PageHeader, PlainButton, Select } from "@/components/ui";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";
import type { AdminInvite } from "@/lib/types";
import { createInvite, revokeInvite } from "../actions";

export const metadata = { title: "Invites" };

function grantLabel(i: AdminInvite) {
  const plan = i.plan === "pro" ? (i.pro_days ? `Pro · ${i.pro_days} days` : "Pro · lifetime") : "Free";
  return i.platform_ai ? `${plan} · built-in AI` : plan;
}

export default async function AdminInvites({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();
  const { data, error } = await db().from("admin_invites").select("*").order("created_at", { ascending: false }).limit(100);
  const invites = (data ?? []) as AdminInvite[];
  const pending = invites.filter((i) => !i.accepted_at);
  const accepted = invites.filter((i) => i.accepted_at);
  const linkFor = (i: AdminInvite) => `${env.appUrl()}/register?invite=${i.token}`;
  const tz = "Asia/Kolkata";

  return (
    <>
      <PageHeader title="Invites" description="Invite people with their access already set: Pro, built-in AI (no API key needed), or both." />
      <Flash searchParams={params} />
      {error && (
        <div className="mb-4">
          <Notice tone="warning">Invites need a small database update. Run <code>supabase/migrations/0002_admin.sql</code> in the Supabase SQL Editor, then reload this page.</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="self-start">
          <CardHeader title="New invite" description="You get a link to send them (no email is sent, so no email limits)." />
          <form action={createInvite} className="space-y-4 p-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="friend@example.com" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select id="plan" name="plan" defaultValue="free">
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="pro_days" hint="(Pro)">Days</Label>
                <Input id="pro_days" name="pro_days" type="number" min={0} placeholder="Lifetime" />
              </div>
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="checkbox" name="platform_ai" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="font-medium">Built-in AI</span>
                <span className="block text-xs text-muted">They write posts with the platform Gemini key. No API key of their own needed.</span>
              </span>
            </label>
            <div>
              <Label htmlFor="note" hint="(only you see this)">Note</Label>
              <Input id="note" name="note" placeholder="e.g. Beta tester" maxLength={200} />
            </div>
            <SubmitButton className="w-full" pending="Creating invite…"><UserPlus className="size-4" /> Create invite</SubmitButton>
            <p className="text-xs text-muted">Already have an account with that email? Their access is updated straight away.</p>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Waiting to sign up" description={`${pending.length} open`} />
            {pending.length ? (
              <ul className="divide-y divide-border">
                {pending.map((i) => (
                  <li key={i.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{i.email}</div>
                        <div className="text-xs text-muted">{grantLabel(i)}{i.note && ` · ${i.note}`} · {formatInZone(i.created_at, tz, { day: "numeric", month: "short" })}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={linkFor(i)} />
                        <a
                          href={`mailto:${i.email}?subject=${encodeURIComponent(`You're invited to ${env.appName()}`)}&body=${encodeURIComponent(`Hi! Here's your invite to ${env.appName()}, the AI LinkedIn assistant:\n\n${linkFor(i)}\n\nOpen it to create your account.`)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium shadow-xs hover:bg-surface-2"
                        >
                          <Mail className="size-3.5" /> Email
                        </a>
                        <form action={revokeInvite}>
                          <input type="hidden" name="id" value={i.id} />
                          <PlainButton type="submit" pending="Revoking…" confirm={`Revoke the invite for ${i.email}?`} className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-danger-soft hover:text-danger">
                            Revoke
                          </PlainButton>
                        </form>
                      </div>
                    </div>
                    <p className="truncate rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-muted">{linkFor(i)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={<UserPlus className="size-5" />} title="No open invites">Create one on the left and send the link.</Empty>
            )}
          </Card>

          <Card>
            <CardHeader title="Accepted" />
            <ul className="divide-y divide-border text-sm">
              {accepted.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span className="min-w-0">
                    {i.accepted_by ? <Link href={`/admin/users/${i.accepted_by}`} className="font-medium hover:underline">{i.email}</Link> : <span className="font-medium">{i.email}</span>}
                    <span className="block text-xs text-muted">{grantLabel(i)}</span>
                  </span>
                  <Badge tone="success">Joined {formatInZone(i.accepted_at!, tz, { day: "numeric", month: "short" })}</Badge>
                </li>
              ))}
              {!accepted.length && <li className="px-5 py-4 text-muted">Nobody yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
