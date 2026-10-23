import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit";
import { Badge, Button, Card, CardHeader, Flash, Input, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { effectivePlan } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { updateUser } from "../../actions";

export const metadata = { title: "User" };

function Action({ userId, action, label, variant = "secondary" }: { userId: string; action: string; label: string; variant?: "secondary" | "danger" | "ghost" }) {
  return (
    <form action={updateUser}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="action" value={action} />
      <Button variant={variant}>{label}</Button>
    </form>
  );
}

export default async function AdminUser({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  await requireAdmin();
  const { data } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const user = data as Profile;
  const tz = "Asia/Kolkata";

  const [{ data: memberships }, { data: events }, { data: payments }] = await Promise.all([
    db().from("workspace_members").select("role, workspaces(id, name, topics)").eq("user_id", id),
    db().from("usage_events").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(40),
    db().from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  const wsIds = (memberships ?? []).map((m) => (m.workspaces as unknown as { id: string }).id);
  const [{ data: accounts }, { count: posts }] = await Promise.all([
    wsIds.length ? db().from("linkedin_accounts").select("name, expires_at, workspace_id").in("workspace_id", wsIds) : Promise.resolve({ data: [] }),
    wsIds.length ? db().from("drafts").select("id", { count: "exact", head: true }).in("workspace_id", wsIds).eq("status", "posted") : Promise.resolve({ count: 0 }),
  ]);
  const plan = effectivePlan(user);

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-text">← Users</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{user.full_name || user.email}</h1>
        <Badge tone={plan === "pro" ? "brand" : "neutral"}>{plan}</Badge>
        <Badge tone={user.status === "active" ? "success" : user.status === "suspended" ? "danger" : "warning"}>{user.status.replace("_", " ")}</Badge>
        {user.role === "admin" && <Badge tone="warning">admin</Badge>}
      </div>
      <Flash searchParams={flash} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              {[
                ["Email", user.email],
                ["Joined", formatInZone(user.created_at, tz)],
                ["Last active", formatInZone(user.last_active_at, tz)],
                ["Pro until", user.plan === "pro" ? (user.paid_until ? formatInZone(user.paid_until, tz, { dateStyle: "medium" }) : "Lifetime") : "—"],
                ["Own Gemini key", user.gemini_key_enc ? "Yes" : "No"],
                ["Telegram / WhatsApp", `${user.telegram_chat_id ? "✓" : "✗"} / ${user.whatsapp_number ? "✓" : "✗"}`],
                ["LinkedIn accounts", String(accounts?.length ?? 0)],
                ["Posts published", String(posts ?? 0)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Workspaces" />
            <ul className="divide-y divide-border text-sm">
              {(memberships ?? []).map((m) => {
                const w = m.workspaces as unknown as { id: string; name: string; topics: string[] };
                return (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span className="font-medium">{w.name}</span>
                    <span className="text-muted">{m.role} · {w.topics.join(", ")}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            <ul className="divide-y divide-border text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="font-medium">{e.type.replaceAll("_", " ")}</span>
                  <span className="truncate text-muted">{Object.values(e.meta ?? {}).join(" · ")}</span>
                  <span className="shrink-0 text-xs text-muted">{formatInZone(e.created_at, tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
              {!events?.length && <li className="px-5 py-4 text-muted">No activity.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Access" />
            <div className="flex flex-wrap gap-2 p-5">
              {user.status !== "active" && <Action userId={id} action="activate" label="Activate" />}
              {user.status !== "suspended" && <Action userId={id} action="suspend" label="Suspend" variant="danger" />}
              {user.role === "admin" ? <Action userId={id} action="demote" label="Remove admin" variant="ghost" /> : <Action userId={id} action="promote" label="Make admin" variant="ghost" />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Plan" />
            <div className="space-y-4 p-5">
              <form action={updateUser} className="flex gap-2">
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="action" value="grant" />
                <Input name="days" type="number" min={1} defaultValue={30} className="w-24" aria-label="Days" />
                <SubmitButton variant="secondary" pending="…">Grant Pro days</SubmitButton>
              </form>
              <div className="flex flex-wrap gap-2">
                <Action userId={id} action="lifetime" label="Lifetime Pro" />
                {user.plan === "pro" && <Action userId={id} action="free" label="Move to Free" variant="ghost" />}
              </div>
              <form action={updateUser} className="space-y-2 border-t border-border pt-4">
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="action" value="manual_payment" />
                <div className="text-xs text-muted">Record an offline payment (bank transfer, cash): activates Pro for one billing period.</div>
                <div className="flex gap-2">
                  <Input name="amount" type="number" min={0} step="0.01" placeholder="Amount" required />
                  <Select name="currency" defaultValue="INR" className="w-24"><option>INR</option><option>USD</option></Select>
                </div>
                <SubmitButton variant="secondary" className="w-full" pending="…">Record payment</SubmitButton>
              </form>
            </div>
          </Card>
          <Card>
            <CardHeader title="Payments" />
            <ul className="divide-y divide-border text-sm">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <span>{p.currency} {Number(p.amount).toLocaleString("en-IN")} · {p.provider}</span>
                  <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge>
                </li>
              ))}
              {!payments?.length && <li className="px-5 py-4 text-muted">No payments.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
