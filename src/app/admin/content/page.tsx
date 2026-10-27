import { FileText, Search } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, Input, PageHeader, Select, type Tone } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "All posts" };

const STATUS_TONE: Record<string, Tone> = { posted: "success", scheduled: "brand", failed: "danger", pending: "neutral", skipped: "neutral", publishing: "warning" };

type Row = {
  id: string;
  text: string;
  status: string;
  format: string;
  origin: string;
  created_at: string;
  scheduled_at: string | null;
  post_url: string | null;
  error: string | null;
  created_by: string | null;
  workspaces: { name: string } | null;
  profiles: { email: string; full_name: string } | null;
};

export default async function AdminContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();
  const q = (params.q ?? "").trim().replace(/[%,()]/g, "");

  let query = db()
    .from("drafts")
    .select("id, text, status, format, origin, created_at, scheduled_at, post_url, error, created_by, workspaces(name), profiles(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("text", `%${q}%`);
  if (params.status && STATUS_TONE[params.status]) query = query.eq("status", params.status);
  if (params.user) {
    // Every workspace the user belongs to, so team posts show too.
    const { data: ms } = await db().from("workspace_members").select("workspace_id").eq("user_id", params.user);
    query = query.in("workspace_id", (ms ?? []).map((m) => m.workspace_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const tz = "Asia/Kolkata";

  return (
    <>
      <PageHeader title="All posts" description="Drafts and posts from every user (newest 100)." />
      <form className="mb-4 flex flex-wrap gap-2">
        {params.user && <input type="hidden" name="user" value={params.user} />}
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Search post text" className="pl-9" />
        </div>
        <Select name="status" defaultValue={params.status ?? ""} className="w-40">
          <option value="">All statuses</option>
          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <button className="rounded-lg border border-border bg-surface px-4 text-sm font-medium shadow-xs hover:bg-surface-2">Filter</button>
        {(params.q || params.status || params.user) && <Link href="/admin/content" className="self-center px-2 text-sm text-muted hover:text-text">Clear</Link>}
      </form>

      <Card className="overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-border text-sm">
            {rows.map((d) => (
              <li key={d.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {d.created_by && d.profiles ? (
                      <Link href={`/admin/users/${d.created_by}`} className="font-medium text-text hover:underline">{d.profiles.full_name || d.profiles.email}</Link>
                    ) : (
                      <span>Auto-draft</span>
                    )}
                    <span>· {d.workspaces?.name ?? "—"}</span>
                    <span>· {d.format === "carousel" ? "Carousel" : "Post"} from {d.origin}</span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-muted">{d.text}</p>
                  {d.error && <p className="mt-1 text-xs text-danger">{d.error}</p>}
                </div>
                <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                  <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                  <span className="text-xs text-muted">
                    {d.status === "scheduled" && d.scheduled_at ? `For ${formatInZone(d.scheduled_at, tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : formatInZone(d.created_at, tz, { day: "numeric", month: "short" })}
                  </span>
                  {d.post_url && <a href={d.post_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View on LinkedIn</a>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<FileText className="size-5" />} title="No posts found" />
        )}
      </Card>
    </>
  );
}
