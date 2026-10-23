import { BarChart3, Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { BarsChart, EngagementChart } from "@/components/charts";
import { SubmitButton } from "@/components/submit";
import { Card, CardHeader, Empty, Flash, Input, Notice, PageHeader, Stat } from "@/components/ui";
import { bestTimes, formatSlot, postsWithMetrics, type PostWithMetrics } from "@/lib/engine/analytics";
import { categoryLabel } from "@/lib/engine/drafts";
import { IMAGE_LABEL } from "@/lib/engine/visual";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { formatInZone } from "@/lib/time";
import { addMetrics } from "../actions";

export const metadata = { title: "Analytics" };

function averageBy(posts: PostWithMetrics[], key: (p: PostWithMetrics) => string) {
  const groups = new Map<string, { total: number; n: number }>();
  for (const p of posts) {
    const k = key(p);
    const g = groups.get(k) ?? { total: 0, n: 0 };
    g.total += p.engagement;
    g.n++;
    groups.set(k, g);
  }
  return [...groups.entries()].map(([label, g]) => ({ label, value: Math.round(g.total / g.n) })).sort((a, b) => b.value - a.value);
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const tz = workspace.timezone;
  const posts = await postsWithMetrics(workspace.id, 180);
  const measured = posts.filter((p) => p.metric);
  const missing = posts.filter((p) => !p.metric).slice(0, 8);

  const sum = (k: "impressions" | "reactions" | "comments") => measured.reduce((s, p) => s + (p.metric?.[k] ?? 0), 0);
  const { slots, personalized } = bestTimes(posts, tz);
  const shortLabel = (p: PostWithMetrics) => categoryLabel(p).split(/[:&]/)[0].trim().slice(0, 14);

  return (
    <>
      <PageHeader title="Analytics" description="Learn what works for your audience, then do more of it." />
      <Flash searchParams={params} />
      <div className="mb-6">
        <Notice tone="neutral">
          LinkedIn only shares personal post stats with apps it has specially approved. Until then, add your numbers from each post's
          analytics on LinkedIn (about 10 seconds a post). Everything below updates instantly.
        </Notice>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Posts (180 days)" value={posts.length} icon={<BarChart3 className="size-4" />} />
        <Stat label="Impressions" value={sum("impressions").toLocaleString("en-IN")} icon={<Eye className="size-4" />} />
        <Stat label="Reactions" value={sum("reactions").toLocaleString("en-IN")} icon={<ThumbsUp className="size-4" />} />
        <Stat label="Comments" value={sum("comments").toLocaleString("en-IN")} icon={<MessageSquare className="size-4" />} />
      </div>

      {measured.length < 2 ? (
        <Card className="mt-6">
          <Empty icon={<BarChart3 className="size-8" />} title="Add results for at least 2 posts to unlock charts" />
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <CardHeader title="Engagement over time" />
            <div className="p-4">
              <EngagementChart data={[...measured].reverse().map((p) => ({ label: formatInZone(p.posted_at!, tz, { day: "numeric", month: "short" }), engagement: p.engagement, posts: 1 }))} />
            </div>
          </Card>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="By topic" description="Average engagement" />
              <div className="p-4"><BarsChart data={averageBy(measured, shortLabel)} valueLabel="Avg. engagement" /></div>
            </Card>
            <Card>
              <CardHeader title="By visual" description="Does an image or carousel help?" />
              <div className="p-4"><BarsChart data={averageBy(measured, (p) => (p.format === "carousel" ? "Carousel" : IMAGE_LABEL[p.image_kind].replace(" card", "")))} valueLabel="Avg. engagement" /></div>
            </Card>
          </div>
        </>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Top posts" />
          {measured.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="px-5 py-2 font-medium">Post</th>
                    <th className="px-3 py-2 text-right font-medium">Impr.</th>
                    <th className="px-3 py-2 text-right font-medium">React.</th>
                    <th className="px-3 py-2 text-right font-medium">Comm.</th>
                    <th className="px-5 py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...measured].sort((a, b) => b.engagement - a.engagement).slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-surface-2">
                      <td className="max-w-xs truncate px-5 py-3"><Link href={`/app/drafts/${p.id}`} className="hover:underline">{p.text.split("\n")[0]}</Link></td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.metric!.impressions.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.metric!.reactions}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.metric!.comments}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{p.engagement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No results yet.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Best times" description={personalized ? "From your results" : "Defaults until 5+ results"} />
          <ul className="divide-y divide-border">
            {slots.map((s) => (
              <li key={`${s.day}${s.hour}`} className="flex justify-between px-5 py-3 text-sm">
                <span className="font-medium">{formatSlot(s)}</span>
                {personalized && <span className="text-muted">{s.basedOn} posts</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {missing.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Add results" description="Posts without numbers yet" />
          <div className="divide-y divide-border">
            {missing.map((p) => (
              <form key={p.id} action={addMetrics} className="grid items-end gap-3 px-5 py-4 sm:grid-cols-[1fr_repeat(4,88px)_auto]">
                <input type="hidden" name="draftId" value={p.id} />
                <input type="hidden" name="back" value="/app/analytics" />
                <div className="min-w-0">
                  <Link href={`/app/drafts/${p.id}`} className="block truncate text-sm font-medium hover:underline">{p.text.split("\n")[0]}</Link>
                  <span className="text-xs text-muted">{formatInZone(p.posted_at!, tz)}</span>
                </div>
                {(["impressions", "reactions", "comments", "reposts"] as const).map((k) => (
                  <label key={k} className="text-xs text-muted">
                    {k}
                    <Input name={k} type="number" min={0} inputMode="numeric" defaultValue={0} className="mt-1" />
                  </label>
                ))}
                <SubmitButton variant="secondary" pending="…">Save</SubmitButton>
              </form>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
