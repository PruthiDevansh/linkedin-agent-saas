import { CreditCard, FileText, Send, Users } from "lucide-react";
import Link from "next/link";
import { BarsChart } from "@/components/charts";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Admin" };

const MODE_LABEL = { free_byok: "Free (own Gemini key)", paid: "Paid only", both: "Free + Paid" };

async function count(table: string) {
  const { count: n } = await db().from(table).select("id", { count: "exact", head: true });
  return n ?? 0;
}

export default async function AdminHome() {
  await requireAdmin();
  const settings = await getSettings();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: profiles }, { data: payments }, { data: events }, totalDrafts] = await Promise.all([
    db().from("profiles").select("id, full_name, email, plan, status, paid_until, created_at, last_active_at"),
    db().from("payments").select("amount, currency, created_at").eq("status", "paid"),
    db().from("usage_events").select("type, user_id, created_at").gte("created_at", since30),
    count("drafts"),
  ]);
  const users = profiles ?? [];
  const isPro = (p: (typeof users)[number]) => p.plan === "pro" && (!p.paid_until || new Date(p.paid_until) > new Date());
  const revenue = (since?: string) =>
    (payments ?? [])
      .filter((p) => !since || p.created_at >= since)
      .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] ?? 0) + Number(p.amount) }), {});
  const fmtRevenue = (r: Record<string, number>) => Object.entries(r).map(([c, v]) => `${c === "INR" ? "₹" : c === "USD" ? "$" : `${c} `}${Math.round(v).toLocaleString("en-IN")}`).join(" + ") || "₹0";

  const ev = events ?? [];
  const published7 = ev.filter((e) => e.type === "post_published" && e.created_at >= since7).length;
  const drafts7 = ev.filter((e) => e.type === "draft_generated" && e.created_at >= since7).length;
  const active7 = new Set(ev.filter((e) => e.created_at >= since7).map((e) => e.user_id)).size;

  // Signups per day, last 14 days.
  const signups = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { label: formatInZone(d, "Asia/Kolkata", { day: "numeric", month: "short" }), value: users.filter((u) => u.created_at.slice(0, 10) === key).length };
  });

  const activity = new Map<string, number>();
  for (const e of ev) if (e.user_id && (e.type === "draft_generated" || e.type === "post_published")) activity.set(e.user_id, (activity.get(e.user_id) ?? 0) + 1);
  const topUsers = [...activity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ user: users.find((u) => u.id === id), n }));

  return (
    <>
      <PageHeader title="Admin overview" description={<>Registration: <Badge tone="brand">{MODE_LABEL[settings.registration_mode]}</Badge></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={users.length} hint={`${active7} active in 7 days`} icon={<Users className="size-4" />} />
        <Stat label="Pro users" value={users.filter(isPro).length} hint={`${users.filter((u) => u.status === "pending_payment").length} awaiting payment`} icon={<CreditCard className="size-4" />} />
        <Stat label="Revenue (30 days)" value={fmtRevenue(revenue(since30))} hint={`All time: ${fmtRevenue(revenue())}`} icon={<CreditCard className="size-4" />} />
        <Stat label="Posts published (7 days)" value={published7} hint={`${drafts7} drafts generated · ${totalDrafts} all time`} icon={<Send className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="New signups" description="Last 14 days" />
          <div className="p-4"><BarsChart data={signups} valueLabel="Signups" /></div>
        </Card>
        <Card>
          <CardHeader title="Most active (30 days)" description="Drafts + posts" />
          <ul className="divide-y divide-border">
            {topUsers.map(({ user, n }) =>
              user ? (
                <li key={user.id}>
                  <Link href={`/admin/users/${user.id}`} className="flex items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-surface-2">
                    <span className="truncate">{user.full_name || user.email}</span>
                    <span className="shrink-0 tabular-nums text-muted"><FileText className="mr-1 inline size-3.5" />{n}</span>
                  </Link>
                </li>
              ) : null,
            )}
            {!topUsers.length && <li className="px-5 py-4 text-sm text-muted">No activity yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
