import { Activity } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Select, type Tone } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Activity" };

const TYPES: Record<string, { label: string; tone: Tone }> = {
  registered: { label: "Signed up", tone: "success" },
  draft_generated: { label: "Draft generated", tone: "brand" },
  post_published: { label: "Post published", tone: "success" },
  admin_action: { label: "Admin action", tone: "warning" },
  admin_view_as: { label: "Admin viewed as", tone: "warning" },
};

type Row = { id: number; type: string; meta: Record<string, unknown> | null; created_at: string; user_id: string | null; profiles: { email: string; full_name: string } | null };

export default async function AdminActivity({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();

  let query = db().from("usage_events").select("id, type, meta, created_at, user_id, profiles(email, full_name)").order("created_at", { ascending: false }).limit(200);
  if (params.type) query = query.eq("type", params.type);
  if (params.user) query = query.eq("user_id", params.user);
  const [{ data }, { data: types }] = await Promise.all([
    query,
    db().from("usage_events").select("type").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(5000),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const typeOptions = [...new Set([...Object.keys(TYPES), ...(types ?? []).map((t) => t.type)])].sort();
  const tz = "Asia/Kolkata";

  return (
    <>
      <PageHeader title="Activity" description="Everything happening across the app, newest first (last 200 events)." />
      <form className="mb-4 flex flex-wrap gap-2">
        {params.user && <input type="hidden" name="user" value={params.user} />}
        <Select name="type" defaultValue={params.type ?? ""} className="w-56">
          <option value="">All events</option>
          {typeOptions.map((t) => <option key={t} value={t}>{TYPES[t]?.label ?? t.replaceAll("_", " ")}</option>)}
        </Select>
        <button className="rounded-lg border border-border bg-surface px-4 text-sm font-medium shadow-xs hover:bg-surface-2">Filter</button>
        {(params.type || params.user) && <Link href="/admin/activity" className="self-center px-2 text-sm text-muted hover:text-text">Clear</Link>}
      </form>

      <Card className="overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-border text-sm">
            {rows.map((e) => {
              const t = TYPES[e.type];
              const details = Object.entries(e.meta ?? {}).map(([k, v]) => `${k.replaceAll("_", " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2/60">
                  <span className="w-36 shrink-0 text-xs tabular-nums text-muted">{formatInZone(e.created_at, tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  <Badge tone={t?.tone ?? "neutral"}>{t?.label ?? e.type.replaceAll("_", " ")}</Badge>
                  {e.user_id && e.profiles ? (
                    <Link href={`/admin/users/${e.user_id}`} className="font-medium hover:underline">{e.profiles.full_name || e.profiles.email}</Link>
                  ) : (
                    <span className="text-muted">System</span>
                  )}
                  {details && <span className="min-w-0 flex-1 truncate text-xs text-muted">{details}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={<Activity className="size-5" />} title="No activity yet" />
        )}
      </Card>
    </>
  );
}
