import { CalendarClock, CheckCircle2, Circle, FileText, Flame, Send, Sparkles, TrendingUp } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { EngagementChart } from "@/components/charts";
import { DraftRow } from "@/components/drafts";
import { ButtonLink, Card, CardHeader, Empty, Flash, PageHeader, Stat } from "@/components/ui";
import { bestTimes, formatSlot, postsWithMetrics } from "@/lib/engine/analytics";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { effectivePlan } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";
import type { Draft } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const tz = workspace.timezone;

  // All independent queries at once: one round trip of waiting instead of five.
  const [{ data: recent }, { count: accounts }, posts, { data: scheduledRows }, { count: pendingCount }] = await Promise.all([
    db().from("drafts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(6),
    db().from("linkedin_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    postsWithMetrics(workspace.id, 90),
    db().from("drafts").select("*").eq("workspace_id", workspace.id).eq("status", "scheduled").order("scheduled_at").limit(3),
    db().from("drafts").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "pending"),
  ]);
  const drafts = (recent ?? []) as Draft[];
  const scheduled = (scheduledRows ?? []) as Draft[];

  const monthAgo = Date.now() - 30 * 86_400_000;
  const postsThisMonth = posts.filter((p) => new Date(p.posted_at!).getTime() > monthAgo).length;
  const measured = posts.filter((p) => p.metric);
  const avgEngagement = measured.length ? Math.round(measured.reduce((s, p) => s + p.engagement, 0) / measured.length) : 0;
  const { slots, personalized } = bestTimes(posts, tz);

  // Posting streak: consecutive weeks with at least one post.
  let streak = 0;
  for (let w = 0; w < 52; w++) {
    const start = Date.now() - (w + 1) * 7 * 86_400_000;
    const end = Date.now() - w * 7 * 86_400_000;
    if (posts.some((p) => { const t = new Date(p.posted_at!).getTime(); return t > start && t <= end; })) streak++;
    else break;
  }

  const chart = [...measured]
    .reverse()
    .slice(-20)
    .map((p) => ({ label: formatInZone(p.posted_at!, tz, { day: "numeric", month: "short" }), engagement: p.engagement, posts: 1 }));

  const plan = effectivePlan(profile);
  const checklist = [
    { done: plan === "pro" || !!profile.gemini_key_enc, label: "Add your Gemini key (or go Pro)", href: "/app/settings#ai" },
    { done: (accounts ?? 0) > 0, label: "Connect LinkedIn", href: "/app/accounts" },
    { done: !!(profile.telegram_chat_id || profile.whatsapp_number), label: "Link Telegram or WhatsApp for 1-tap approval", href: "/app/settings#channels" },
    { done: !!workspace.about, label: "Describe yourself so posts sound like you", href: "/app/settings" },
    { done: posts.length > 0, label: "Publish your first post", href: "/app/create" },
  ];
  const setupLeft = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader
        title={`Hi ${profile.full_name.split(" ")[0] || "there"} 👋`}
        description="Here's how your LinkedIn is growing."
        action={
          <>
            <ButtonLink href="/app/create" ><Sparkles className="size-4" /> Create post</ButtonLink>
          </>
        }
      />
      <Flash searchParams={params} />

      {setupLeft > 0 && (
        <Card className="mb-6">
          <CardHeader title="Get set up" description={`${checklist.length - setupLeft} of ${checklist.length} done`} />
          <ul className="divide-y divide-border">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                  {c.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted" />}
                  <span className={c.done ? "text-muted line-through" : "font-medium"}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Posts (30 days)" value={postsThisMonth} icon={<Send className="size-4" />} />
        <Stat label="Avg. engagement" value={avgEngagement} hint={measured.length ? `from ${measured.length} posts with results` : "add results to see this"} icon={<TrendingUp className="size-4" />} />
        <Stat label="Waiting for you" value={pendingCount ?? 0} hint="drafts to review" icon={<FileText className="size-4" />} />
        <Stat label="Weekly streak" value={`${streak} wk`} hint={streak ? "keep it going!" : "post this week to start"} icon={<Flame className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Engagement" description="Reactions + 2× comments + 3× reposts, per post" />
          <div className="p-4">
            {chart.length >= 2 ? (
              <EngagementChart data={chart} />
            ) : (
              <Empty icon={<TrendingUp className="size-8" />} title="No results yet">
                After posting, add each post's likes and comments on the Analytics page. LinkedIn's automatic stats need extra API approval, so they're added by hand for now.
              </Empty>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Best times to post" description={personalized ? "Based on your results" : "LinkedIn-wide defaults until you have 5+ results"} />
            <ul className="divide-y divide-border">
              {slots.map((s) => (
                <li key={`${s.day}${s.hour}`} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{formatSlot(s)}</span>
                  {personalized && <span className="text-muted">avg {s.score}</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Up next" action={<Link href="/app/calendar" className="text-sm text-brand hover:underline">Calendar</Link>} />
            {scheduled.length ? (
              <ul className="divide-y divide-border">
                {scheduled.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/drafts/${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                      <CalendarClock className="size-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate">{d.text.split("\n")[0]}</span>
                      <span className="shrink-0 text-xs text-muted">{formatInZone(d.scheduled_at!, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nothing scheduled. Open a draft and pick "Best time".</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent posts" action={<Link href="/app/drafts" className="text-sm text-brand hover:underline">See all</Link>} />
        {drafts.length ? (
          <div className="divide-y divide-border">{drafts.map((d) => <DraftRow key={d.id} draft={d} timezone={tz} />)}</div>
        ) : (
          <Empty icon={<Sparkles className="size-8" />} title="No posts yet">
            <Link href="/app/create" className="text-brand hover:underline">Create your first post</Link> or wait for tomorrow's automatic draft.
          </Empty>
        )}
      </Card>
    </>
  );
}
