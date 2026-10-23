import { FileText, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { DraftRow, STATUS } from "@/components/drafts";
import { ButtonLink, Card, cx, Empty, Flash, PageHeader } from "@/components/ui";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { Draft, DraftStatus } from "@/lib/types";

export const metadata = { title: "Posts" };

const FILTERS: (DraftStatus | "all")[] = ["all", "pending", "scheduled", "posted", "failed", "skipped"];

export default async function DraftsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const filter = (FILTERS as string[]).includes(params.status) ? (params.status as DraftStatus | "all") : "all";

  let query = db().from("drafts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query;
  const drafts = (data ?? []) as Draft[];

  return (
    <>
      <PageHeader title="Posts" description="All drafts, scheduled and published posts in this workspace." action={<ButtonLink href="/app/create"><Sparkles className="size-4" /> Create</ButtonLink>} />
      <Flash searchParams={params} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/app/drafts" : `/app/drafts?status=${f}`}
            className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", filter === f ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted hover:text-text")}
          >
            {f === "all" ? "All" : STATUS[f].label}
          </Link>
        ))}
      </div>
      <Card>
        {drafts.length ? (
          <div className="divide-y divide-border">{drafts.map((d) => <DraftRow key={d.id} draft={d} timezone={workspace.timezone} />)}</div>
        ) : (
          <Empty icon={<FileText className="size-8" />} title="Nothing here yet">Create a post or wait for your daily draft.</Empty>
        )}
      </Card>
    </>
  );
}
