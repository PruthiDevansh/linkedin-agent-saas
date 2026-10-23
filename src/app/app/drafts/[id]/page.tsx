import { CalendarClock, ExternalLink, MessageCircle, Send, Trash2, Wand2, XCircle } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/drafts";
import { SlidesEditor } from "@/components/slides-editor";
import { SubmitButton } from "@/components/submit";
import { Button, Card, CardHeader, cx, Flash, Input, Label, Notice, Select, Textarea } from "@/components/ui";
import { bestTimes, formatSlot, nextSlot, postsWithMetrics } from "@/lib/engine/analytics";
import { categoryLabel, getDraft } from "@/lib/engine/drafts";
import { availableKinds, IMAGE_LABEL } from "@/lib/engine/visual";
import { canEdit, currentWorkspace, requireActiveUser } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone, utcToZonedWallTime } from "@/lib/time";
import {
  addMetrics,
  deleteDraft,
  publishNow,
  saveDraftText,
  scheduleAt,
  scheduleBestTime,
  sendDraftToChat,
  setImageKind,
  skipDraftAction,
  unschedule,
  uploadDraftPhoto,
} from "../../actions";

// AI writing and LinkedIn uploads can take 20-40s; server actions on this page share this limit.
export const maxDuration = 60;

export const metadata = { title: "Post" };

export default async function DraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  const profile = await requireActiveUser();
  const { workspace, role } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const draft = await getDraft(id);
  if (!draft || draft.workspace_id !== workspace.id) notFound();

  const tz = workspace.timezone;
  const editable = canEdit(role) && ["pending", "scheduled", "failed"].includes(draft.status);
  const { data: accounts } = await db().from("linkedin_accounts").select("id, name").eq("workspace_id", workspace.id);
  const { data: metrics } = await db().from("post_metrics").select("*").eq("draft_id", draft.id).order("recorded_at", { ascending: false }).limit(1);
  const latest = metrics?.[0];
  const { slots } = bestTimes(await postsWithMetrics(workspace.id), tz);
  const best = nextSlot(slots, tz);
  const version = encodeURIComponent(draft.updated_at);
  const hasPhoto = !!(draft.photo_path || draft.telegram_photo_id);
  const linked = !!(profile.telegram_chat_id || profile.whatsapp_number);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/app/drafts" className="text-sm text-muted hover:text-text">← Posts</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {categoryLabel(draft)} <StatusBadge status={draft.status} />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {draft.status === "scheduled" && draft.scheduled_at && <>Goes live {formatInZone(draft.scheduled_at, tz)} · </>}
            {draft.status === "posted" && draft.posted_at && <>Posted {formatInZone(draft.posted_at, tz)} · </>}
            Created {formatInZone(draft.created_at, tz)}
          </p>
        </div>
        {draft.post_url && (
          <a href={draft.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            View on LinkedIn <ExternalLink className="size-4" />
          </a>
        )}
      </div>
      <Flash searchParams={flash} />
      {draft.status === "failed" && draft.error && <div className="mb-4"><Notice tone="danger">Last attempt failed: {draft.error}</Notice></div>}
      {draft.source_url && (
        <div className="mb-4">
          <Notice tone="neutral">
            Source: <a href={draft.source_url} target="_blank" rel="noreferrer" className="font-medium underline">{draft.source_title}</a>. Check the facts before posting.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Text / slides editor */}
        <Card>
          <CardHeader title="Post text" description={`${draft.text.length} / 3000 characters`} />
          <form action={saveDraftText} className="space-y-4 p-5">
            <input type="hidden" name="draftId" value={draft.id} />
            <Textarea name="text" defaultValue={draft.text} disabled={!editable} className="min-h-80 font-[450]" />
            {draft.format === "carousel" && draft.slides && (
              <div>
                <Label>Slides</Label>
                <SlidesEditor initial={draft.slides} disabled={!editable} />
              </div>
            )}
            {(accounts?.length ?? 0) > 1 && (
              <div>
                <Label htmlFor="account">Post as</Label>
                <Select id="account" name="account" defaultValue={draft.linkedin_account_id ?? ""} disabled={!editable}>
                  {accounts!.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            )}
            {editable && <SubmitButton variant="secondary" pending="Saving…">Save changes</SubmitButton>}
          </form>
        </Card>

        <div className="space-y-6">
          {/* Visual */}
          <Card>
            <CardHeader title={draft.format === "carousel" ? `Carousel · ${draft.slides?.length ?? 0} slides` : "Image"} />
            <div className="p-4">
              {draft.format === "carousel" ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {draft.slides?.map((_, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={`/api/media/draft/${draft.id}?slide=${i}&v=${version}`} alt={`Slide ${i + 1}`} loading="lazy" className="aspect-[4/5] w-56 shrink-0 snap-start rounded-lg border border-border object-cover" />
                  ))}
                </div>
              ) : draft.image_kind !== "none" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/draft/${draft.id}?v=${version}`} alt="Post image" className="aspect-square w-full rounded-lg border border-border object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-border text-sm text-muted">Text-only post</div>
              )}

              {draft.format === "post" && editable && (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {availableKinds(draft.visual, hasPhoto).map((k) => (
                      <form key={k} action={setImageKind}>
                        <input type="hidden" name="draftId" value={draft.id} />
                        <input type="hidden" name="kind" value={k} />
                        <button className={cx("rounded-full border px-3 py-1 text-xs font-medium", draft.image_kind === k ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-text")}>
                          {IMAGE_LABEL[k]}
                        </button>
                      </form>
                    ))}
                  </div>
                  <form action={uploadDraftPhoto} className="mt-3 flex items-center gap-2">
                    <input type="hidden" name="draftId" value={draft.id} />
                    <Input name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1" />
                    <SubmitButton variant="secondary" pending="…">Use</SubmitButton>
                  </form>
                </>
              )}
            </div>
          </Card>

          {/* Publish & schedule */}
          {editable && (
            <Card>
              <CardHeader title="Publish" />
              <div className="space-y-4 p-5">
                {!accounts?.length && <Notice tone="warning">Connect LinkedIn on the <Link href="/app/accounts" className="font-semibold underline">Accounts</Link> page to publish.</Notice>}
                <form action={publishNow}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <SubmitButton className="w-full" pending="Posting to LinkedIn…" disabled={!accounts?.length}><Send className="size-4" /> Post now</SubmitButton>
                </form>

                <form action={scheduleBestTime}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <SubmitButton variant="secondary" className="w-full" pending="Scheduling…"><Wand2 className="size-4" /> Best time: {formatInZone(best, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}</SubmitButton>
                </form>
                <p className="-mt-2 text-xs text-muted">Top slots: {slots.map(formatSlot).join(" · ")}</p>

                <form action={scheduleAt} className="flex gap-2">
                  <input type="hidden" name="draftId" value={draft.id} />
                  <Input type="datetime-local" name="when" required defaultValue={draft.scheduled_at ? utcToZonedWallTime(new Date(draft.scheduled_at), tz) : utcToZonedWallTime(best, tz)} aria-label={`Schedule time (${tz})`} />
                  <SubmitButton variant="secondary" pending="…"><CalendarClock className="size-4" /></SubmitButton>
                </form>
                <p className="-mt-2 text-xs text-muted">Times are in {tz}.</p>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {draft.status === "scheduled" && (
                    <form action={unschedule}><input type="hidden" name="draftId" value={draft.id} /><Button variant="ghost">Unschedule</Button></form>
                  )}
                  {linked && (
                    <form action={sendDraftToChat}><input type="hidden" name="draftId" value={draft.id} /><Button variant="ghost"><MessageCircle className="size-4" /> Send to chat</Button></form>
                  )}
                  <form action={skipDraftAction}><input type="hidden" name="draftId" value={draft.id} /><Button variant="ghost"><XCircle className="size-4" /> Skip</Button></form>
                  <form action={deleteDraft}><input type="hidden" name="draftId" value={draft.id} /><Button variant="ghost" className="text-danger"><Trash2 className="size-4" /> Delete</Button></form>
                </div>
              </div>
            </Card>
          )}

          {/* Results */}
          {draft.status === "posted" && (
            <Card>
              <CardHeader title="Results" description="Copy the numbers from LinkedIn. They power your analytics and best times." />
              <form action={addMetrics} className="grid grid-cols-2 gap-3 p-5">
                <input type="hidden" name="draftId" value={draft.id} />
                {(["impressions", "reactions", "comments", "reposts"] as const).map((k) => (
                  <div key={k}>
                    <Label htmlFor={k}>{k[0].toUpperCase() + k.slice(1)}</Label>
                    <Input id={k} name={k} type="number" min={0} inputMode="numeric" defaultValue={latest?.[k] ?? 0} />
                  </div>
                ))}
                <SubmitButton className="col-span-2" variant="secondary" pending="Saving…">Save results</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
