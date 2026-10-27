import { Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserToggle } from "@/components/admin";
import { ResetLinkForm } from "@/components/reset-link-form";
import { SubmitButton } from "@/components/submit";
import { Badge, Button, Card, CardHeader, Flash, Input, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { effectivePlan } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { deleteUser, setUserPassword, startImpersonating, updateUser } from "../../actions";

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
  const admin = await requireAdmin();
  const [{ data }, { data: memberships }, { data: events }, { data: payments }, { data: authUser }] = await Promise.all([
    db().from("profiles").select("*").eq("id", id).maybeSingle(),
    db().from("workspace_members").select("role, workspaces(id, name, topics)").eq("user_id", id),
    db().from("usage_events").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(40),
    db().from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db().auth.admin.getUserById(id),
  ]);
  if (!data) notFound();
  const user = data as Profile;
  const tz = "Asia/Kolkata";
  const emailConfirmed = !!authUser?.user?.email_confirmed_at;

  const wsIds = (memberships ?? []).map((m) => (m.workspaces as unknown as { id: string }).id);
  const [{ data: accounts }, { count: posts }, { data: recent }] = await Promise.all([
    wsIds.length ? db().from("linkedin_accounts").select("name, expires_at, workspace_id").in("workspace_id", wsIds) : Promise.resolve({ data: [] }),
    wsIds.length ? db().from("drafts").select("id", { count: "exact", head: true }).in("workspace_id", wsIds).eq("status", "posted") : Promise.resolve({ count: 0 }),
    wsIds.length
      ? db().from("drafts").select("id, text, status, format, created_at, post_url").in("workspace_id", wsIds).order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  const plan = effectivePlan(user);
  const pro = plan === "pro" && user.role !== "admin";

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-text">← Users</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{user.full_name || user.email}</h1>
        <Badge tone={plan === "pro" ? "brand" : "neutral"}>{plan}</Badge>
        <Badge tone={user.status === "active" ? "success" : user.status === "suspended" ? "danger" : "warning"}>{user.status.replace("_", " ")}</Badge>
        {user.role === "admin" && <Badge tone="warning">admin</Badge>}
        {id !== admin.id && (
          <form action={startImpersonating} className="ml-auto">
            <input type="hidden" name="userId" value={id} />
            <Button type="submit" pending="Opening their app…"><Eye className="size-4" /> View as this user</Button>
          </form>
        )}
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
                ["Email confirmed", emailConfirmed ? "Yes" : "No"],
                ["AI", user.platform_ai ? "Built-in (platform key)" : user.gemini_key_enc ? "Own Gemini key" : plan === "pro" ? "Built-in (Pro)" : "No key yet"],
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
            <CardHeader title="Latest posts" description="Across all their workspaces" action={<Link href={`/admin/content?user=${id}`} className="text-sm text-brand hover:underline">See all</Link>} />
            <ul className="divide-y divide-border text-sm">
              {(recent ?? []).map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-5 py-3">
                  <p className="line-clamp-2 min-w-0 flex-1 text-muted">{d.text}</p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={d.status === "posted" ? "success" : d.status === "failed" ? "danger" : d.status === "scheduled" ? "brand" : "neutral"}>{d.status}</Badge>
                    {d.post_url ? (
                      <a href={d.post_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View on LinkedIn</a>
                    ) : (
                      <span className="text-xs text-muted">{formatInZone(d.created_at, tz, { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </li>
              ))}
              {!recent?.length && <li className="px-5 py-4 text-muted">No posts yet.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent activity" action={<Link href={`/admin/activity?user=${id}`} className="text-sm text-brand hover:underline">See all</Link>} />
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
            <CardHeader title="Quick switches" description="Apply instantly" />
            <div className="space-y-4 p-5">
              <UserToggle userId={id} on={pro} onAction="lifetime" offAction="free" label={<span><b className="font-medium">Pro plan</b><span className="block text-xs text-muted">{pro ? (user.paid_until ? `Until ${formatInZone(user.paid_until, tz, { dateStyle: "medium" })}` : "No end date") : "Free plan limits"}</span></span>} />
              <UserToggle userId={id} on={!!user.platform_ai} onAction="ai_on" offAction="ai_off" label={<span><b className="font-medium">Built-in AI</b><span className="block text-xs text-muted">Write posts with the platform Gemini key, no own key needed</span></span>} />
              <UserToggle
                userId={id}
                on={user.status !== "suspended"}
                onAction="activate"
                offAction="suspend"
                confirm={user.status !== "suspended" ? `Suspend ${user.email}? They won't be able to use the app.` : undefined}
                label={<span><b className="font-medium">Account access</b><span className="block text-xs text-muted">{user.status === "suspended" ? "Suspended" : user.status === "pending_payment" ? "Awaiting payment" : "Can use the app"}</span></span>}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Access" />
            <div className="flex flex-wrap gap-2 p-5">
              {user.status === "pending_payment" && <Action userId={id} action="activate" label="Activate without payment" />}
              {!emailConfirmed && <Action userId={id} action="confirm_email" label="Confirm email" />}
              {user.role === "admin" ? <Action userId={id} action="demote" label="Remove admin" variant="ghost" /> : <Action userId={id} action="promote" label="Make admin" variant="ghost" />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Login help" description="No emails are sent, so email limits don't matter" />
            <div className="space-y-4 p-5">
              <form action={setUserPassword} className="space-y-2">
                <input type="hidden" name="userId" value={id} />
                <div className="flex gap-2">
                  <Input name="password" type="text" minLength={8} placeholder="New password (8+ chars)" autoComplete="off" required />
                  <SubmitButton variant="secondary" pending="Saving…">Set</SubmitButton>
                </div>
              </form>
              <ResetLinkForm userId={id} />
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
          {id !== admin.id && (
            <Card className="border-danger/30">
              <CardHeader title="Danger zone" />
              <form action={deleteUser} className="space-y-2 p-5">
                <input type="hidden" name="userId" value={id} />
                <p className="text-xs text-muted">Deletes the login, their workspaces, LinkedIn connections and all posts. This can't be undone.</p>
                <Button type="submit" variant="danger" className="w-full" pending="Deleting…" confirm={`Permanently delete ${user.email} and all their data? This can't be undone.`}>
                  Delete user
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
