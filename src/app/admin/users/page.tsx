import { MessageCircle, Search, Send } from "lucide-react";
import Link from "next/link";
import { Badge, Card, cx, Input, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();
  const q = (params.q ?? "").trim();

  let query = db().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`email.ilike.%${q.replace(/[%,()]/g, "")}%,full_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (params.plan === "pro" || params.plan === "free") query = query.eq("plan", params.plan);
  if (["active", "pending_payment", "suspended"].includes(params.status)) query = query.eq("status", params.status);
  const { data: users } = await query;

  const ids = (users ?? []).map((u) => u.id);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: events }, { data: memberships }] = await Promise.all([
    ids.length ? db().from("usage_events").select("user_id, type").in("user_id", ids).gte("created_at", since).in("type", ["draft_generated", "post_published"]) : Promise.resolve({ data: [] }),
    ids.length ? db().from("workspace_members").select("user_id, workspace_id").in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const wsIds = [...new Set((memberships ?? []).map((m) => m.workspace_id))];
  const { data: accounts } = wsIds.length ? await db().from("linkedin_accounts").select("workspace_id").in("workspace_id", wsIds) : { data: [] };
  const usage = (id: string, type: string) => (events ?? []).filter((e) => e.user_id === id && e.type === type).length;
  const linkedinCount = (id: string) => {
    const mine = new Set((memberships ?? []).filter((m) => m.user_id === id).map((m) => m.workspace_id));
    return (accounts ?? []).filter((a) => mine.has(a.workspace_id)).length;
  };

  return (
    <>
      <PageHeader title="Users" description={`${users?.length ?? 0} shown · usage counts are for the last 30 days`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search name or email" className="pl-9" />
        </div>
        <Select name="plan" defaultValue={params.plan ?? ""} className="w-32"><option value="">All plans</option><option value="pro">Pro</option><option value="free">Free</option></Select>
        <Select name="status" defaultValue={params.status ?? ""} className="w-44"><option value="">All statuses</option><option value="active">Active</option><option value="pending_payment">Awaiting payment</option><option value="suspended">Suspended</option></Select>
        <button className="rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">Filter</button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Channels</th>
                <th className="px-3 py-2.5 text-right font-medium">LinkedIn</th>
                <th className="px-3 py-2.5 text-right font-medium">Drafts</th>
                <th className="px-3 py-2.5 text-right font-medium">Posts</th>
                <th className="px-5 py-2.5 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map((u) => {
                const pro = u.plan === "pro" && (!u.paid_until || new Date(u.paid_until) > new Date());
                return (
                  <tr key={u.id} className="hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.full_name || "—"}</Link>
                      <div className="text-xs text-muted">{u.email}{u.role === "admin" && " · admin"}</div>
                    </td>
                    <td className="px-3 py-3"><Badge tone={pro ? "brand" : "neutral"}>{pro ? "Pro" : u.plan === "pro" ? "Expired" : "Free"}</Badge></td>
                    <td className="px-3 py-3"><Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "warning"}>{u.status.replace("_", " ")}</Badge></td>
                    <td className="px-3 py-3">
                      <span className="flex gap-1.5 text-muted">
                        <Send className={cx("size-4", u.telegram_chat_id ? "text-[#229ED9]" : "opacity-25")} aria-label="Telegram" />
                        <MessageCircle className={cx("size-4", u.whatsapp_number ? "text-[#25D366]" : "opacity-25")} aria-label="WhatsApp" />
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{linkedinCount(u.id)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{usage(u.id, "draft_generated")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{usage(u.id, "post_published")}</td>
                    <td className="px-5 py-3 text-xs text-muted">{formatInZone(u.last_active_at, "Asia/Kolkata", { dateStyle: "medium" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
