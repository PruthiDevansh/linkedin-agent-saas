import { ArrowUpRight, Flame, LayoutTemplate, Sparkles, Star, Zap } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Badge, Card, CardHeader, cx, PageHeader } from "@/components/ui";
import { HOOKS, TEMPLATES } from "@/lib/engine/library";
import { findCandidates } from "@/lib/engine/sources";
import { CATEGORIES, isCategoryId } from "@/lib/engine/topics";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { db } from "@/lib/supabase";

export const metadata = { title: "Inspiration" };

const TABS = [
  { id: "trending", label: "Trending now", icon: Flame },
  { id: "hooks", label: "Hooks", icon: Zap },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "curated", label: "Curated", icon: Star },
];

const useIdea = (text: string) => `/app/create?tab=idea&idea=${encodeURIComponent(text.slice(0, 1200))}`;

export default async function InspirationPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "trending";

  return (
    <>
      <PageHeader title="Inspiration" description="Trending stories in your topics, proven hook formulas and post structures. Click any to write with it." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link key={id} href={`/app/inspiration?tab=${id}`} className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm", tab === id ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted hover:text-text")}>
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </div>

      {tab === "trending" && <Trending topics={workspace.topics} />}

      {tab === "hooks" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOOKS.map((h) => (
            <Link key={h.text} href={useIdea(`Write a post that opens with this hook formula: "${h.text}". My angle: `)} className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand">
              <Badge tone="brand">{h.category}</Badge>
              <p className="mt-2 font-medium leading-snug">{h.text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">Use this hook <ArrowUpRight className="size-3.5" /></span>
            </Link>
          ))}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-4 md:grid-cols-2">
          {TEMPLATES.map((t) => (
            <Card key={t.name} className="flex flex-col">
              <CardHeader title={t.name} description={t.when} />
              <pre className="flex-1 whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-relaxed text-muted">{t.structure}</pre>
              <div className="border-t border-border px-5 py-3">
                <Link href={useIdea(`Use the "${t.name}" structure:\n${t.structure}\n\nMy content: `)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                  <Sparkles className="size-4" /> Write with this template
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "curated" && <Curated />}
    </>
  );
}

async function Trending({ topics }: { topics: string[] }) {
  const valid = topics.filter(isCategoryId).slice(0, 3);
  const lists = await Promise.all(valid.map(async (t) => ({ topic: t, items: (await findCandidates(t, new Set())).slice(0, 6) })));
  return (
    <div className="space-y-6">
      {lists.map(({ topic, items }) => (
        <Card key={topic}>
          <CardHeader title={CATEGORIES[topic].label} description="Fresh from the last few days, most upvoted first" />
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.url} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{c.title}</a>
                  <div className="mt-0.5 text-xs text-muted">{c.source}{c.points ? ` · 🔥 ${c.points} points` : ""}</div>
                </div>
                <Link href={useIdea(`React to this news with my opinion: "${c.title}" (${c.url}). ${c.snippet}`)} className="text-sm font-medium text-brand hover:underline">Write about this</Link>
              </li>
            ))}
            {!items.length && <li className="px-5 py-4 text-sm text-muted">No fresh stories right now.</li>}
          </ul>
        </Card>
      ))}
      {!lists.length && <p className="text-sm text-muted">Pick your topics in Settings to see trending stories.</p>}
    </div>
  );
}

async function Curated() {
  const { data } = await db().from("inspiration_items").select("*").in("kind", ["curated", "hook", "template"]).order("created_at", { ascending: false }).limit(60);
  if (!data?.length) return <p className="text-sm text-muted">No curated examples yet. The team adds great posts here regularly.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((item) => (
        <Card key={item.id} className="flex flex-col p-5">
          <Badge tone="brand">{item.category}</Badge>
          <h3 className="mt-2 font-semibold">{item.title}</h3>
          <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-muted">{item.body}</p>
          <div className="mt-4 flex gap-4 text-sm">
            <Link href={useIdea(`Inspired by this example (don't copy it, use my own angle):\n${item.body}\n\nMy angle: `)} className="font-medium text-brand">Write something like this</Link>
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="text-muted hover:text-text">Source</a>}
          </div>
        </Card>
      ))}
    </div>
  );
}
