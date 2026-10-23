"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { notifyDraft } from "@/lib/channels/chat";
import { encrypt, shortCode } from "@/lib/crypto";
import { AiKeyMissingError, testAiKey } from "@/lib/engine/ai";
import { bestTimes, nextSlot, postsWithMetrics } from "@/lib/engine/analytics";
import {
  createCarouselDraft,
  createIdeaDraft,
  createNewsDraft,
  getDraft,
  LimitError,
  publishDraft,
  scheduleDraft,
  skipDraft,
  updateDraft,
} from "@/lib/engine/drafts";
import { savePhoto } from "@/lib/engine/media";
import { isCategoryId } from "@/lib/engine/topics";
import { canEdit, currentWorkspace, requireActiveUser } from "@/lib/session";
import { db } from "@/lib/supabase";
import { zonedWallTimeToUtc } from "@/lib/time";
import type { Draft, ImageKind, ImageTheme } from "@/lib/types";

const go = (path: string, params: Record<string, string> = {}): never => {
  const qs = new URLSearchParams(params).toString();
  redirect(qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path);
};

async function ctx() {
  const profile = await requireActiveUser();
  const ws = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  return { profile, ...ws };
}

async function editableCtx() {
  const c = await ctx();
  if (!canEdit(c.role)) go("/app", { error: "You have view-only access to this workspace." });
  return c;
}

async function editableDraft(form: FormData): Promise<{ draft: Draft; c: Awaited<ReturnType<typeof ctx>> }> {
  const c = await editableCtx();
  const draft = await getDraft(String(form.get("draftId")));
  if (!draft || draft.workspace_id !== c.workspace.id) go("/app/drafts", { error: "Post not found." });
  return { draft: draft!, c };
}

function errorMessage(err: unknown) {
  if (err instanceof AiKeyMissingError || err instanceof LimitError) return err.message;
  // redirect() works by throwing; let it through.
  if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
  return err instanceof Error ? err.message : "Something went wrong.";
}

// ------------------------------------------------------------------ workspace

export async function switchWorkspace(form: FormData) {
  const profile = await requireActiveUser();
  const id = String(form.get("workspace"));
  const ws = await currentWorkspace(profile, id);
  (await cookies()).set("ws", ws.workspace.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

export async function createWorkspace(form: FormData) {
  const { profile } = await ctx();
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "New workspace";
  const { data, error } = await db().from("workspaces").insert({ owner_id: profile.id, name }).select().single();
  if (error) go("/app/accounts", { error: error.message });
  await db().from("workspace_members").insert({ workspace_id: data!.id, user_id: profile.id, role: "owner" });
  (await cookies()).set("ws", data!.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  go("/app/accounts", { ok: `Workspace "${name}" created.` });
}

export async function saveBrand(form: FormData) {
  const c = await editableCtx();
  const topics = form.getAll("topics").map(String).filter(isCategoryId);
  const theme = String(form.get("image_theme"));
  const { error } = await db()
    .from("workspaces")
    .update({
      name: String(form.get("name") ?? c.workspace.name).slice(0, 60),
      about: String(form.get("about") ?? "").slice(0, 600),
      audience: String(form.get("audience") ?? "").slice(0, 300),
      voice: String(form.get("voice") ?? "").slice(0, 600) || c.workspace.voice,
      topics: topics.length ? topics : c.workspace.topics,
      timezone: String(form.get("timezone") ?? c.workspace.timezone),
      auto_draft: form.get("auto_draft") === "on",
      draft_hour: Math.min(23, Math.max(0, Number(form.get("draft_hour") ?? 8))),
      image_theme: (["navy", "light", "sunset"].includes(theme) ? theme : "navy") as ImageTheme,
    })
    .eq("id", c.workspace.id);
  if (error) go("/app/settings", { error: error.message });
  revalidatePath("/app", "layout");
  go("/app/settings", { ok: "Saved." });
}

// ------------------------------------------------------------------ AI key

export async function saveGeminiKey(form: FormData) {
  const { profile } = await ctx();
  const back = String(form.get("back") ?? "/app/settings");
  const key = String(form.get("key") ?? "").trim();
  if (!/^[A-Za-z0-9_\-]{20,}$/.test(key)) go(back, { error: "That doesn't look like a Gemini API key." });
  try {
    await testAiKey(key);
  } catch (err) {
    go(back, { error: `Google rejected this key: ${errorMessage(err)}` });
  }
  await db().from("profiles").update({ gemini_key_enc: encrypt(key) }).eq("id", profile.id);
  revalidatePath("/app", "layout");
  go(back === "/onboarding" ? "/app" : back, { ok: "Your Gemini key works and is saved securely." });
}

export async function removeGeminiKey() {
  const { profile } = await ctx();
  await db().from("profiles").update({ gemini_key_enc: null }).eq("id", profile.id);
  revalidatePath("/app", "layout");
  go("/app/settings", { ok: "Key removed." });
}

// ------------------------------------------------------------------ creating

async function afterCreate(draft: Draft | null, sendToChat: boolean) {
  if (!draft) go("/app/create", { error: "No fresh news for that topic this week. Try another topic." });
  if (sendToChat) await notifyDraft(draft!).catch(() => {});
  revalidatePath("/app");
  go(`/app/drafts/${draft!.id}`, { ok: "Draft ready. Review it, then post or schedule." });
}

export async function generateNews(form: FormData) {
  const c = await editableCtx();
  const cat = String(form.get("category") ?? "");
  let draft: Draft | null = null;
  try {
    draft = await createNewsDraft(c.profile, c.workspace.id, isCategoryId(cat) ? cat : undefined);
  } catch (err) {
    go("/app/create", { error: errorMessage(err) });
  }
  await afterCreate(draft, form.get("chat") === "on");
}

export async function generateIdea(form: FormData) {
  const c = await editableCtx();
  const idea = String(form.get("idea") ?? "").trim();
  if (idea.length < 10) go("/app/create?tab=idea", { error: "Write at least a sentence about your idea." });
  const photo = form.get("photo");
  let path: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 8 * 1024 * 1024 || !/^image\/(png|jpe?g|webp)$/.test(photo.type)) go("/app/create?tab=idea", { error: "Photo must be a PNG, JPG or WEBP under 8 MB." });
    path = `${c.workspace.id}/uploads/${Date.now()}-${randomBytes(4).toString("hex")}.${photo.type.split("/")[1]}`;
    await savePhoto(path, await photo.arrayBuffer(), photo.type);
  }
  let draft: Draft | null = null;
  try {
    draft = await createIdeaDraft(c.profile, c.workspace.id, idea.slice(0, 1500), path ? { path } : undefined);
  } catch (err) {
    go("/app/create?tab=idea", { error: errorMessage(err) });
  }
  await afterCreate(draft, form.get("chat") === "on");
}

export async function generateCarousel(form: FormData) {
  const c = await editableCtx();
  const subject = String(form.get("subject") ?? "").trim();
  if (subject.length < 10) go("/app/create?tab=carousel", { error: "Describe the carousel subject in at least a sentence." });
  let draft: Draft | null = null;
  try {
    draft = await createCarouselDraft(c.profile, c.workspace.id, subject.slice(0, 1500));
  } catch (err) {
    go("/app/create?tab=carousel", { error: errorMessage(err) });
  }
  await afterCreate(draft, form.get("chat") === "on");
}

// ------------------------------------------------------------------ editing a draft

export async function saveDraftText(form: FormData) {
  const { draft } = await editableDraft(form);
  const text = String(form.get("text") ?? "").trim().slice(0, 2900);
  if (!text) go(`/app/drafts/${draft.id}`, { error: "The post can't be empty." });
  const slides = form.get("slides");
  const fields: Partial<Draft> = { text };
  if (typeof slides === "string" && slides) {
    try {
      const parsed = JSON.parse(slides) as { title: string; body: string }[];
      fields.slides = parsed.filter((s) => s.title?.trim()).slice(0, 10).map((s) => ({ title: s.title.slice(0, 90), body: (s.body ?? "").slice(0, 260) }));
    } catch {
      go(`/app/drafts/${draft.id}`, { error: "Could not read the slides." });
    }
  }
  const account = String(form.get("account") ?? "");
  if (account) fields.linkedin_account_id = account;
  await updateDraft(draft.id, fields);
  go(`/app/drafts/${draft.id}`, { ok: "Saved." });
}

export async function setImageKind(form: FormData) {
  const { draft } = await editableDraft(form);
  const kind = String(form.get("kind")) as ImageKind;
  if (!["card", "flowchart", "quote", "photo", "none"].includes(kind)) go(`/app/drafts/${draft.id}`);
  await updateDraft(draft.id, { image_kind: kind });
  go(`/app/drafts/${draft.id}`);
}

export async function uploadDraftPhoto(form: FormData) {
  const { draft, c } = await editableDraft(form);
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) go(`/app/drafts/${draft.id}`, { error: "Choose a photo first." });
  const file = photo as File;
  if (file.size > 8 * 1024 * 1024 || !/^image\/(png|jpe?g|webp)$/.test(file.type)) go(`/app/drafts/${draft.id}`, { error: "Photo must be a PNG, JPG or WEBP under 8 MB." });
  const path = `${c.workspace.id}/uploads/${draft.id}-${Date.now()}.${file.type.split("/")[1]}`;
  await savePhoto(path, await file.arrayBuffer(), file.type);
  await updateDraft(draft.id, { photo_path: path, telegram_photo_id: null, image_kind: "photo" });
  go(`/app/drafts/${draft.id}`, { ok: "Photo added." });
}

export async function scheduleAt(form: FormData) {
  const { draft, c } = await editableDraft(form);
  const wall = String(form.get("when") ?? "");
  if (!wall) go(`/app/drafts/${draft.id}`, { error: "Pick a date and time." });
  try {
    await scheduleDraft(draft, zonedWallTimeToUtc(wall, c.workspace.timezone));
  } catch (err) {
    go(`/app/drafts/${draft.id}`, { error: errorMessage(err) });
  }
  go(`/app/drafts/${draft.id}`, { ok: "Scheduled. It will be posted automatically." });
}

export async function scheduleBestTime(form: FormData) {
  const { draft, c } = await editableDraft(form);
  const { slots } = bestTimes(await postsWithMetrics(c.workspace.id), c.workspace.timezone);
  try {
    await scheduleDraft(draft, nextSlot(slots, c.workspace.timezone));
  } catch (err) {
    go(`/app/drafts/${draft.id}`, { error: errorMessage(err) });
  }
  go(`/app/drafts/${draft.id}`, { ok: "Scheduled for your next best time slot." });
}

export async function unschedule(form: FormData) {
  const { draft } = await editableDraft(form);
  if (draft.status === "scheduled") await updateDraft(draft.id, { status: "pending", scheduled_at: null });
  go(`/app/drafts/${draft.id}`, { ok: "Unscheduled." });
}

export async function publishNow(form: FormData) {
  const { draft, c } = await editableDraft(form);
  const result = await publishDraft(draft.id, c.profile.id);
  revalidatePath("/app");
  if (!result.ok) go(`/app/drafts/${draft.id}`, { error: result.message });
  go(`/app/drafts/${draft.id}`, { ok: "Posted on LinkedIn! 🎉" });
}

export async function skipDraftAction(form: FormData) {
  const { draft } = await editableDraft(form);
  await skipDraft(draft);
  go("/app/drafts", { ok: "Skipped." });
}

export async function deleteDraft(form: FormData) {
  const { draft } = await editableDraft(form);
  if (draft.status === "posted") go(`/app/drafts/${draft.id}`, { error: "Published posts stay for your analytics." });
  await db().from("drafts").delete().eq("id", draft.id);
  go("/app/drafts", { ok: "Deleted." });
}

export async function sendDraftToChat(form: FormData) {
  const { draft } = await editableDraft(form);
  await notifyDraft(draft);
  go(`/app/drafts/${draft.id}`, { ok: "Sent to your linked Telegram/WhatsApp." });
}

export async function addMetrics(form: FormData) {
  const { draft } = await editableDraft(form);
  const n = (k: string) => Math.max(0, Math.floor(Number(form.get(k) ?? 0)) || 0);
  await db().from("post_metrics").insert({ draft_id: draft.id, impressions: n("impressions"), reactions: n("reactions"), comments: n("comments"), reposts: n("reposts") });
  revalidatePath("/app/analytics");
  go(String(form.get("back") ?? `/app/drafts/${draft.id}`), { ok: "Results saved. Your best-time suggestions just got smarter." });
}

// ------------------------------------------------------------------ chat linking

export async function createLinkCode() {
  const { profile } = await ctx();
  await db().from("profiles").update({ link_code: shortCode(8) }).eq("id", profile.id);
  go("/app/settings#channels");
}

export async function unlinkChannel(form: FormData) {
  const { profile } = await ctx();
  const field = form.get("channel") === "whatsapp" ? "whatsapp_number" : "telegram_chat_id";
  await db().from("profiles").update({ [field]: null }).eq("id", profile.id);
  go("/app/settings#channels", { ok: "Disconnected." });
}

// ------------------------------------------------------------------ LinkedIn & team

export async function disconnectLinkedIn(form: FormData) {
  const c = await editableCtx();
  await db().from("linkedin_accounts").delete().eq("id", String(form.get("accountId"))).eq("workspace_id", c.workspace.id);
  go("/app/accounts", { ok: "LinkedIn account removed." });
}

export async function inviteMember(form: FormData) {
  const c = await ctx();
  if (c.role !== "owner") go("/app/accounts", { error: "Only the workspace owner can invite people." });
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "viewer" ? "viewer" : "editor";
  if (!/^\S+@\S+\.\S+$/.test(email)) go("/app/accounts", { error: "Enter a valid email." });
  const token = randomBytes(18).toString("base64url");
  await db().from("workspace_invites").insert({ workspace_id: c.workspace.id, email, role, token });
  go("/app/accounts", { ok: "Invite created. Copy the link below and send it to them.", invite: token });
}

export async function removeMember(form: FormData) {
  const c = await ctx();
  if (c.role !== "owner") go("/app/accounts", { error: "Only the owner can remove members." });
  const userId = String(form.get("userId"));
  if (userId === c.profile.id) go("/app/accounts", { error: "You can't remove yourself as owner." });
  await db().from("workspace_members").delete().eq("workspace_id", c.workspace.id).eq("user_id", userId);
  go("/app/accounts", { ok: "Member removed." });
}

export async function revokeInvite(form: FormData) {
  const c = await ctx();
  if (c.role !== "owner") go("/app/accounts");
  await db().from("workspace_invites").delete().eq("id", String(form.get("inviteId"))).eq("workspace_id", c.workspace.id);
  go("/app/accounts", { ok: "Invite revoked." });
}
