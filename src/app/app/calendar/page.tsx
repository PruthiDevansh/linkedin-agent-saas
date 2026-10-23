import { ChevronLeft, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { STATUS } from "@/components/drafts";
import { Card, cx, PageHeader } from "@/components/ui";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone, zonedWallTimeToUtc } from "@/lib/time";
import type { Draft } from "@/lib/types";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const tz = workspace.timezone;

  // Month shown, in the workspace's timezone.
  const today = formatInZone(new Date(), tz, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-"); // dd/mm/yyyy -> yyyy-mm-dd
  const [ty, tm] = today.split("-").map(Number);
  const [year, month] = /^\d{4}-\d{2}$/.test(params.m ?? "") ? params.m.split("-").map(Number) : [ty, tm];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first

  const from = zonedWallTimeToUtc(`${year}-${String(month).padStart(2, "0")}-01T00:00`, tz);
  const to = zonedWallTimeToUtc(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01T00:00`, tz);
  const { data } = await db()
    .from("drafts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .or(`and(scheduled_at.gte.${from.toISOString()},scheduled_at.lt.${to.toISOString()}),and(posted_at.gte.${from.toISOString()},posted_at.lt.${to.toISOString()})`);
  const byDay = new Map<number, Draft[]>();
  for (const d of (data ?? []) as Draft[]) {
    const when = d.status === "posted" ? d.posted_at : d.scheduled_at;
    if (!when) continue;
    const day = Number(formatInZone(when, tz, { day: "numeric" }));
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  }

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const isThisMonth = year === ty && month === tm;
  const todayNum = Number(today.split("-")[2]);

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Scheduled and published posts · ${tz}`}
        action={
          <div className="flex items-center gap-1">
            <Link href={`/app/calendar?m=${shift(-1)}`} className="rounded-lg border border-border p-2 hover:bg-surface-2" aria-label="Previous month"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-36 text-center text-sm font-medium">{title}</span>
            <Link href={`/app/calendar?m=${shift(1)}`} className="rounded-lg border border-border p-2 hover:bg-surface-2" aria-label="Next month"><ChevronRight className="size-4" /></Link>
          </div>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="min-h-20 border-b border-r border-border bg-surface-2/40 sm:min-h-28" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const items = byDay.get(day) ?? [];
            return (
              <div key={day} className="min-h-20 border-b border-r border-border p-1 sm:min-h-28 sm:p-2">
                <div className={cx("mb-1 inline-grid size-6 place-items-center rounded-full text-xs", isThisMonth && day === todayNum ? "bg-brand font-semibold text-white" : "text-muted")}>{day}</div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((d) => (
                    <Link
                      key={d.id}
                      href={`/app/drafts/${d.id}`}
                      title={d.text.split("\n")[0]}
                      className={cx("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium", d.status === "posted" ? "bg-success-soft text-success" : d.status === "failed" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand")}
                    >
                      <span className="hidden sm:inline">{formatInZone((d.status === "posted" ? d.posted_at : d.scheduled_at)!, tz, { hour: "numeric", minute: "2-digit" })} · </span>
                      {d.text.split("\n")[0]}
                    </Link>
                  ))}
                  {items.length > 3 && <div className="px-1 text-[11px] text-muted">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand" /> {STATUS.scheduled.label}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" /> {STATUS.posted.label}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-danger" /> {STATUS.failed.label}</span>
      </div>
    </>
  );
}
