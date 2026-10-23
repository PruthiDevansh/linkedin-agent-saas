import { db } from "../supabase";
import type { Draft, PostMetric } from "../types";

export type PostWithMetrics = Draft & { metric: PostMetric | null; engagement: number };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Reactions count 1, comments 2 (they matter most for reach), reposts 3.
export function engagementScore(m: PostMetric | null): number {
  if (!m) return 0;
  return m.reactions + m.comments * 2 + m.reposts * 3;
}

export async function postsWithMetrics(workspaceId: string, sinceDays = 90): Promise<PostWithMetrics[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data: posts } = await db()
    .from("drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "posted")
    .gte("posted_at", since)
    .order("posted_at", { ascending: false });
  const ids = (posts ?? []).map((p) => p.id);
  const { data: metrics } = ids.length
    ? await db().from("post_metrics").select("*").in("draft_id", ids).order("recorded_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, PostMetric>();
  for (const m of (metrics ?? []) as PostMetric[]) if (!latest.has(m.draft_id)) latest.set(m.draft_id, m);
  return ((posts ?? []) as Draft[]).map((p) => {
    const metric = latest.get(p.id) ?? null;
    return { ...p, metric, engagement: engagementScore(metric) };
  });
}

function localParts(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso));
  return { day: parts.find((p) => p.type === "weekday")!.value, hour: Number(parts.find((p) => p.type === "hour")!.value) };
}

export type Slot = { day: string; hour: number; score: number; basedOn: number };

// Best posting slots from your own results; LinkedIn-wide defaults until you have data.
export function bestTimes(posts: PostWithMetrics[], timezone: string): { slots: Slot[]; personalized: boolean } {
  const measured = posts.filter((p) => p.metric && p.posted_at);
  if (measured.length >= 5) {
    const buckets = new Map<string, { total: number; n: number; day: string; hour: number }>();
    for (const p of measured) {
      const { day, hour } = localParts(p.posted_at!, timezone);
      const key = `${day}-${hour}`;
      const b = buckets.get(key) ?? { total: 0, n: 0, day, hour };
      b.total += p.engagement;
      b.n++;
      buckets.set(key, b);
    }
    const slots = [...buckets.values()]
      .map((b) => ({ day: b.day, hour: b.hour, score: Math.round(b.total / b.n), basedOn: b.n }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { slots, personalized: true };
  }
  return {
    personalized: false,
    slots: [
      { day: "Tue", hour: 9, score: 0, basedOn: 0 },
      { day: "Wed", hour: 9, score: 0, basedOn: 0 },
      { day: "Thu", hour: 8, score: 0, basedOn: 0 },
    ],
  };
}

// The next calendar time (UTC) matching one of the slots, in the workspace's timezone.
export function nextSlot(slots: Slot[], timezone: string, from = new Date()): Date {
  for (let h = 1; h <= 24 * 8; h++) {
    const t = new Date(from.getTime() + h * 3600_000);
    t.setUTCMinutes(0, 0, 0);
    const { day, hour } = localParts(t.toISOString(), timezone);
    if (slots.some((s) => s.day === day && s.hour === hour)) return t;
  }
  return new Date(from.getTime() + 24 * 3600_000);
}

export function formatSlot(s: Slot) {
  const h = s.hour % 12 || 12;
  return `${s.day} ${h}:00 ${s.hour < 12 ? "AM" : "PM"}`;
}

export { DAYS };
