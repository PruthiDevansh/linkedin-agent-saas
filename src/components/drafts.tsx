import { FileText, Images, Lightbulb, Newspaper } from "lucide-react";
import Link from "next/link";
import { categoryLabel } from "@/lib/engine/drafts";
import { formatInZone } from "@/lib/time";
import type { Draft, DraftStatus } from "@/lib/types";
import { Badge, type Tone } from "./ui";

export const STATUS: Record<DraftStatus, { label: string; tone: Tone }> = {
  pending: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "brand" },
  publishing: { label: "Publishing", tone: "warning" },
  posted: { label: "Posted", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

function OriginIcon({ draft }: { draft: Draft }) {
  const Icon = draft.format === "carousel" ? Images : draft.origin === "idea" ? Lightbulb : draft.origin === "news" ? Newspaper : FileText;
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
      <Icon className="size-4.5" />
    </div>
  );
}

export function DraftRow({ draft, timezone }: { draft: Draft; timezone: string }) {
  const when =
    draft.status === "scheduled" && draft.scheduled_at
      ? `Scheduled ${formatInZone(draft.scheduled_at, timezone)}`
      : draft.status === "posted" && draft.posted_at
        ? `Posted ${formatInZone(draft.posted_at, timezone)}`
        : `Created ${formatInZone(draft.created_at, timezone)}`;
  return (
    <Link href={`/app/drafts/${draft.id}`} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2">
      <OriginIcon draft={draft} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{draft.text.split("\n")[0]}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{categoryLabel(draft)}</span>
          <span>{when}</span>
        </div>
      </div>
      <StatusBadge status={draft.status} />
    </Link>
  );
}
