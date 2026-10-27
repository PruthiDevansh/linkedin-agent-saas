import { getSettings, dailyDraftLimit } from "../settings";
import { db } from "../supabase";
import type { Draft, ImageKind, LinkedInAccount, Profile, Workspace } from "../types";
import { aiKeyFor, writeCarousel, writeIdeaPost, writeNewsPost } from "./ai";
import { LinkedInAuthError, publish, type Attachment } from "./linkedin";
import { authorName, draftCarouselPdf, draftImage } from "./media";
import { fetchTrendingSearches, findCandidates } from "./sources";
import { categoryForToday, topicLabel } from "./topics";
import { nextImageKind } from "./visual";

export class LimitError extends Error {}

export async function logUsage(userId: string | null, workspaceId: string | null, type: string, meta: Record<string, unknown> = {}) {
  await db().from("usage_events").insert({ user_id: userId, workspace_id: workspaceId, type, meta });
}

async function getWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await db().from("workspaces").select("*").eq("id", id).single();
  if (error) throw new Error("Workspace not found.");
  return data as Workspace;
}

export async function getDraft(id: string): Promise<Draft | null> {
  const { data } = await db().from("drafts").select("*").eq("id", id).maybeSingle();
  return (data as Draft) ?? null;
}

export async function updateDraft(id: string, fields: Partial<Draft>): Promise<Draft> {
  const { data, error } = await db()
    .from("drafts")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Could not update the draft: ${error.message}`);
  return data as Draft;
}

// Plan limits: drafts generated per day.
async function checkDailyLimit(profile: Profile) {
  const settings = await getSettings();
  const limit = dailyDraftLimit(settings, profile);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db()
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("type", "draft_generated")
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    throw new LimitError(`You've reached your limit of ${limit} AI drafts per 24 hours. Upgrade to Pro for more.`);
  }
}

async function insertDraft(fields: Partial<Draft>): Promise<Draft> {
  const { data, error } = await db().from("drafts").insert(fields).select().single();
  if (error) throw new Error(`Could not save the draft: ${error.message}`);
  return data as Draft;
}

export async function defaultAccountId(workspaceId: string): Promise<string | null> {
  const { data } = await db().from("linkedin_accounts").select("id").eq("workspace_id", workspaceId).order("created_at").limit(1);
  return data?.[0]?.id ?? null;
}

// ------------------------------------------------------------------ creation

export async function createNewsDraft(profile: Profile, workspaceId: string, category?: string): Promise<Draft | null> {
  await checkDailyLimit(profile);
  const ws = await getWorkspace(workspaceId);
  const cat = category ?? categoryForToday(ws.topics, ws.timezone);
  const key = await aiKeyFor(profile);

  const { data: used } = await db().from("used_links").select("url").eq("workspace_id", ws.id);
  const [candidates, trending] = await Promise.all([findCandidates(cat, new Set((used ?? []).map((u) => u.url))), fetchTrendingSearches()]);
  if (!candidates.length) return null;

  const content = await writeNewsPost(key, ws, await authorName(profile.id), cat, candidates, trending);
  await db().from("used_links").upsert({ workspace_id: ws.id, url: content.sourceUrl });
  const draft = await insertDraft({
    workspace_id: ws.id,
    linkedin_account_id: await defaultAccountId(ws.id),
    created_by: profile.id,
    origin: "news",
    category: cat,
    topic: content.topic,
    source_title: content.sourceTitle,
    source_url: content.sourceUrl,
    text: content.post,
    visual: content.visual,
    image_kind: content.visual.suggested,
  });
  await logUsage(profile.id, ws.id, "draft_generated", { origin: "news", category: cat });
  return draft;
}

export async function createIdeaDraft(profile: Profile, workspaceId: string, idea: string, photo?: { telegramId?: string; path?: string }) {
  await checkDailyLimit(profile);
  const ws = await getWorkspace(workspaceId);
  const { post, visual } = await writeIdeaPost(await aiKeyFor(profile), ws, await authorName(profile.id), idea);
  const draft = await insertDraft({
    workspace_id: ws.id,
    linkedin_account_id: await defaultAccountId(ws.id),
    created_by: profile.id,
    origin: "idea",
    idea,
    topic: idea.slice(0, 80),
    text: post,
    visual,
    image_kind: photo ? "photo" : visual.suggested,
    telegram_photo_id: photo?.telegramId ?? null,
    photo_path: photo?.path ?? null,
  });
  await logUsage(profile.id, ws.id, "draft_generated", { origin: "idea" });
  return draft;
}

export async function createCarouselDraft(profile: Profile, workspaceId: string, subject: string) {
  await checkDailyLimit(profile);
  const ws = await getWorkspace(workspaceId);
  const { caption, slides } = await writeCarousel(await aiKeyFor(profile), ws, await authorName(profile.id), subject);
  const draft = await insertDraft({
    workspace_id: ws.id,
    linkedin_account_id: await defaultAccountId(ws.id),
    created_by: profile.id,
    origin: "idea",
    idea: subject,
    topic: slides[0].title,
    text: caption,
    format: "carousel",
    slides,
    image_kind: "none",
  });
  await logUsage(profile.id, ws.id, "draft_generated", { origin: "carousel" });
  return draft;
}

// ------------------------------------------------------------------ editing

export async function cycleImage(draft: Draft): Promise<Draft> {
  const kind: ImageKind = nextImageKind(draft.image_kind, draft.visual, !!(draft.photo_path || draft.telegram_photo_id));
  return updateDraft(draft.id, { image_kind: kind });
}

export async function scheduleDraft(draft: Draft, at: Date): Promise<Draft> {
  if (at.getTime() < Date.now() + 60_000) throw new Error("Pick a time at least 1 minute in the future.");
  if (!["pending", "scheduled", "failed"].includes(draft.status)) throw new Error(`This post is already ${draft.status}.`);
  return updateDraft(draft.id, { status: "scheduled", scheduled_at: at.toISOString(), error: null });
}

export async function skipDraft(draft: Draft): Promise<Draft> {
  return updateDraft(draft.id, { status: "skipped", scheduled_at: null });
}

// ------------------------------------------------------------------ publishing

export type PublishResult = { ok: true; url: string } | { ok: false; reason: "auth" | "no_account" | "busy" | "error"; message: string };

export async function publishDraft(draftId: string, actorId: string | null): Promise<PublishResult> {
  // Atomic claim: only one caller can move a draft into "publishing". No double posts.
  const { data: claimed } = await db()
    .from("drafts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .in("status", ["pending", "scheduled", "failed"])
    .select()
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "busy", message: "This post is already published or being published." };
  const draft = claimed as Draft;

  const fail = async (reason: "auth" | "no_account" | "error", message: string): Promise<PublishResult> => {
    await updateDraft(draft.id, { status: "failed", error: message });
    return { ok: false, reason, message };
  };

  try {
    const accountId = draft.linkedin_account_id ?? (await defaultAccountId(draft.workspace_id));
    if (!accountId) return fail("no_account", "Connect a LinkedIn account first (Accounts page).");
    const { data: account } = await db().from("linkedin_accounts").select("*").eq("id", accountId).single();
    const ws = await getWorkspace(draft.workspace_id);

    let attachment: Attachment | undefined;
    if (draft.format === "carousel") {
      const pdf = await draftCarouselPdf(draft, ws);
      if (pdf) attachment = { type: "document", bytes: pdf, title: draft.slides?.[0]?.title ?? draft.topic };
    } else {
      const bytes = await draftImage(draft, ws);
      if (bytes) attachment = { type: "image", bytes, altText: draft.visual?.title ?? draft.topic };
    }

    const result = await publish(account as LinkedInAccount, draft.text, attachment);
    await updateDraft(draft.id, {
      status: "posted",
      posted_at: new Date().toISOString(),
      post_urn: result.urn,
      post_url: result.url,
      linkedin_account_id: accountId,
      error: null,
    });
    await logUsage(actorId, draft.workspace_id, "post_published", { format: draft.format, image: draft.image_kind });
    return { ok: true, url: result.url };
  } catch (err) {
    if (err instanceof LinkedInAuthError) return fail("auth", "Your LinkedIn login expired. Reconnect it on the Accounts page.");
    return fail("error", err instanceof Error ? err.message : String(err));
  }
}

export function categoryLabel(draft: Draft): string {
  if (draft.format === "carousel") return "Carousel";
  if (draft.origin === "idea") return "Your idea";
  return draft.category ? topicLabel(draft.category) : "Post";
}
