import { env } from "../env";
import { db } from "../supabase";
import type { Draft, PendingAction, Profile, Workspace } from "../types";
import { AiKeyMissingError } from "../engine/ai";
import {
  categoryLabel,
  createCarouselDraft,
  createIdeaDraft,
  createNewsDraft,
  cycleImage,
  getDraft,
  LimitError,
  publishDraft,
  skipDraft,
  updateDraft,
} from "../engine/drafts";
import { draftCarouselPdf, draftImage, savePhoto } from "../engine/media";
import { CATEGORIES, CATEGORY_IDS, isCategoryId } from "../engine/topics";
import { IMAGE_LABEL } from "../engine/visual";
import { telegramChannel } from "./telegram";
import type { ChatButton, ChatChannel, ChatImage } from "./types";
import { whatsappChannel, whatsappEnabled } from "./whatsapp";

const HELP = (app: string) =>
  [
    `🤖 ${app}: your LinkedIn growth agent. Nothing is posted without your OK.`,
    "",
    "/draft: post from today's trending news (/draft fintech for a topic)",
    "/write <idea>: turn your idea into an engaging post",
    "/carousel <subject>: make a swipeable carousel",
    "📷 Photo + caption: a post about your photo",
    "📷 Photo alone: use it as the image of your latest draft",
    "/topics · /status · /help",
    "",
    `Full dashboard, schedule & analytics: ${env.appUrl()}/app`,
  ].join("\n");

async function setPending(profile: Profile, action: PendingAction | null) {
  await db().from("profiles").update({ pending_action: action }).eq("id", profile.id);
}

async function workspaceOf(draft: Draft): Promise<Workspace> {
  const { data } = await db().from("workspaces").select("*").eq("id", draft.workspace_id).single();
  return data as Workspace;
}

function buttonsFor(draft: Draft, ch: ChatChannel): ChatButton[] {
  const id = draft.id;
  if (ch.kind === "whatsapp") {
    return [
      { id: `post:${id}`, label: "✅ Post now" },
      { id: `img:${id}`, label: "🖼 Change image" },
      { id: `regen:${id}`, label: "🔄 New draft" },
    ];
  }
  return [
    { id: `post:${id}`, label: "✅ Post to LinkedIn" },
    { id: `edit:${id}`, label: "✏️ Edit" },
    ...(draft.format === "post" ? [{ id: `img:${id}`, label: "🖼 Change image" }] : []),
    { id: `regen:${id}`, label: "🔄 New draft" },
    { id: `skip:${id}`, label: "❌ Skip" },
    { id: `open:${id}`, label: "🗓 Schedule in app" },
  ];
}

// Show a draft (image + text + buttons) and remember the message ids.
export async function showDraft(ch: ChatChannel, draft: Draft) {
  if (draft.chat_refs) await ch.clear(draft.chat_refs);
  const ws = await workspaceOf(draft);

  let image: ChatImage | undefined;
  try {
    if (draft.format === "carousel") {
      const pdf = await draftCarouselPdf(draft, ws);
      if (pdf) image = { kind: "pdf", bytes: pdf };
    } else {
      const png = await draftImage(draft, ws);
      if (png) image = { kind: "png", bytes: png };
    }
  } catch (err) {
    console.error("Image for chat failed:", err);
  }

  const header =
    draft.origin === "news"
      ? [`📝 ${categoryLabel(draft)}`, `Source: ${draft.source_title}`, draft.source_url ?? "", "Check the facts in the source before posting."]
      : [`📝 ${categoryLabel(draft)}`, draft.idea ? `Idea: ${draft.idea.slice(0, 200)}` : ""];
  if (draft.format === "post") header.push(`🖼 ${IMAGE_LABEL[draft.image_kind]}`);
  if (draft.format === "carousel") header.push(`🎠 ${draft.slides?.length ?? 0} slides (PDF above)`);

  const text = [...header.filter(Boolean), "━━━━━━━━━━", "", draft.text].join("\n");
  const refs = await ch.draft(text, buttonsFor(draft, ch), image);
  await updateDraft(draft.id, { chat_refs: { ...draft.chat_refs, ...refs } });
}

function friendlyError(err: unknown): string {
  if (err instanceof AiKeyMissingError || err instanceof LimitError) return `⚠️ ${err.message}`;
  return `⚠️ Something went wrong: ${err instanceof Error ? err.message : String(err)}`;
}

async function guard(ch: ChatChannel, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error("Chat error:", err);
    await ch.text(friendlyError(err)).catch(() => {});
  }
}

async function ownDraft(profile: Profile, id: string): Promise<Draft | null> {
  const draft = await getDraft(id);
  if (!draft) return null;
  const { data } = await db().from("workspace_members").select("role").eq("workspace_id", draft.workspace_id).eq("user_id", profile.id).maybeSingle();
  return data && data.role !== "viewer" ? draft : null;
}

// ------------------------------------------------------------------ entry points

export async function linkAccount(code: string, link: { telegramChatId?: number; whatsappNumber?: string }): Promise<Profile | null> {
  const { data } = await db().from("profiles").select("*").eq("link_code", code.trim().toUpperCase()).maybeSingle();
  if (!data) return null;
  const fields: Record<string, unknown> = { link_code: null };
  if (link.telegramChatId) fields.telegram_chat_id = link.telegramChatId;
  if (link.whatsappNumber) fields.whatsapp_number = link.whatsappNumber;
  await db().from("profiles").update(fields).eq("id", data.id);
  return data as Profile;
}

export async function handleText(profile: Profile, ch: ChatChannel, raw: string) {
  const text = raw.trim();
  const [first, ...rest] = text.split(/\s+/);
  const command = first.toLowerCase().replace(/^\//, "");
  const arg = rest.join(" ").trim();
  const wsId = profile.default_workspace_id!;

  await guard(ch, async () => {
    if (command === "start" || command === "help") return ch.text(HELP(env.appName()));
    if (command === "topics") return ch.text(CATEGORY_IDS.map((id) => `${id}: ${CATEGORIES[id].label}`).join("\n"));
    if (command === "status") {
      const { data: accounts } = await db().from("linkedin_accounts").select("name, expires_at").eq("workspace_id", wsId);
      const lines = (accounts ?? []).map((a) => `🔗 ${a.name}: ${Math.max(0, Math.floor((new Date(a.expires_at).getTime() - Date.now()) / 86_400_000))} days left`);
      return ch.text([`👤 ${profile.email} · plan: ${profile.plan}`, ...(lines.length ? lines : ["🔗 No LinkedIn connected yet."]), `Manage: ${env.appUrl()}/app/accounts`].join("\n"));
    }
    if (command === "draft") {
      if (arg && !isCategoryId(arg)) return ch.text(`Unknown topic "${arg}". Send /topics to see the list.`);
      await ch.text("🔎 Finding today's trending news…");
      const draft = await createNewsDraft(profile, wsId, arg && isCategoryId(arg) ? arg : undefined);
      return draft ? showDraft(ch, draft) : ch.text("😴 No fresh news for that topic this week. Try another one.");
    }
    if (command === "write" || command === "idea") {
      if (!arg) {
        await setPending(profile, { type: "idea" });
        return ch.ask("💡 Send me your idea in a line or two. I'll turn it into a post.");
      }
      await ch.text("✍️ Writing a post from your idea…");
      return showDraft(ch, await createIdeaDraft(profile, wsId, arg.slice(0, 1500)));
    }
    if (command === "carousel") {
      if (!arg) return ch.text("🎠 Send /carousel followed by the subject, e.g. /carousel 5 lessons from my first year as a developer");
      await ch.text("🎠 Building your carousel…");
      return showDraft(ch, await createCarouselDraft(profile, wsId, arg.slice(0, 1500)));
    }
    if (ch.kind === "whatsapp" && ["edit", "skip", "image"].includes(command)) {
      const { data } = await db().from("drafts").select("id").eq("workspace_id", wsId).eq("status", "pending").order("created_at", { ascending: false }).limit(1);
      const latest = data?.[0]?.id;
      if (!latest) return ch.text("No pending draft. Send 'draft' or 'idea <text>'.");
      return handleAction(profile, ch, command === "image" ? "img" : command, latest);
    }

    // Free text: the answer to an edit, or an idea.
    const pending = profile.pending_action;
    await setPending(profile, null);
    if (pending?.type === "edit") {
      const draft = await ownDraft(profile, pending.draftId);
      if (!draft || !["pending", "scheduled", "failed"].includes(draft.status)) return ch.text("That draft can't be edited any more.");
      return showDraft(ch, await updateDraft(draft.id, { text: text.slice(0, 2800) }));
    }
    if (pending?.type === "idea" || text.length >= 15) {
      await ch.text("✍️ Writing a post from your idea…");
      return showDraft(ch, await createIdeaDraft(profile, wsId, text.slice(0, 1500)));
    }
    return ch.text(HELP(env.appName()));
  });
}

export async function handleAction(profile: Profile, ch: ChatChannel, action: string, draftId: string) {
  await guard(ch, async () => {
    const draft = await ownDraft(profile, draftId);
    if (!draft) return ch.text("This draft is no longer available.");

    if (action === "post") {
      await ch.text("⏳ Posting to LinkedIn…");
      const result = await publishDraft(draft.id, profile.id);
      await ch.clear(draft.chat_refs).catch(() => {});
      return ch.text(result.ok ? `✅ Posted!\n${result.url}` : `⚠️ ${result.message}`);
    }
    if (action === "edit") {
      await setPending(profile, { type: "edit", draftId: draft.id });
      return ch.ask("✏️ Send the full new text for this post. I'll show it again before posting.");
    }
    if (action === "img") {
      if (draft.format !== "post") return ch.text("Carousels use their slides as the image.");
      return showDraft(ch, await cycleImage(draft));
    }
    if (action === "skip") {
      await skipDraft(draft);
      await ch.clear(draft.chat_refs);
      return ch.text("❌ Skipped.");
    }
    if (action === "regen") {
      await skipDraft(draft);
      await ch.clear(draft.chat_refs);
      await ch.text("🔄 Writing a new draft…");
      const next =
        draft.format === "carousel" && draft.idea
          ? await createCarouselDraft(profile, draft.workspace_id, draft.idea)
          : draft.origin === "idea" && draft.idea
            ? await createIdeaDraft(profile, draft.workspace_id, draft.idea)
            : await createNewsDraft(profile, draft.workspace_id, draft.category && isCategoryId(draft.category) ? draft.category : undefined);
      return next ? showDraft(ch, next) : ch.text("😴 No fresh news for that topic right now.");
    }
    if (action === "open") return ch.text(`🗓 Edit, schedule or see analytics here:\n${env.appUrl()}/app/drafts/${draft.id}`);
  });
}

// A photo from chat: with a caption it's a new post, alone it becomes the latest draft's image.
export async function handlePhoto(profile: Profile, ch: ChatChannel, photo: { telegramId?: string; bytes?: ArrayBuffer; mime?: string }, caption: string) {
  await guard(ch, async () => {
    const wsId = profile.default_workspace_id!;
    let path: string | undefined;
    if (photo.bytes) {
      path = `${wsId}/chat/${Date.now()}.${photo.mime?.includes("png") ? "png" : "jpg"}`;
      await savePhoto(path, photo.bytes, photo.mime ?? "image/jpeg");
    }
    if (caption.trim().length >= 15) {
      await ch.text("✍️ Writing a post around your photo…");
      return showDraft(ch, await createIdeaDraft(profile, wsId, caption.slice(0, 1500), { telegramId: photo.telegramId, path }));
    }
    const { data } = await db().from("drafts").select("*").eq("workspace_id", wsId).eq("status", "pending").eq("format", "post").order("created_at", { ascending: false }).limit(1);
    const latest = data?.[0] as Draft | undefined;
    if (!latest) return ch.text("📷 Got it! Send the photo again with a caption (your idea) and I'll write a post around it.");
    return showDraft(ch, await updateDraft(latest.id, { image_kind: "photo", telegram_photo_id: photo.telegramId ?? null, photo_path: path ?? null }));
  });
}

// Send a new draft to every chat the user has linked (used by the scheduler and portal).
export async function notifyDraft(draft: Draft) {
  const userId = draft.created_by;
  if (!userId) return;
  const { data } = await db().from("profiles").select("telegram_chat_id, whatsapp_number").eq("id", userId).single();
  if (data?.telegram_chat_id && env.telegramToken()) await showDraft(telegramChannel(data.telegram_chat_id), draft).catch((e) => console.error("Telegram notify failed:", e));
  if (data?.whatsapp_number && whatsappEnabled()) await showDraft(whatsappChannel(data.whatsapp_number), draft).catch((e) => console.error("WhatsApp notify failed:", e));
}

export async function notifyText(userId: string, text: string) {
  const { data } = await db().from("profiles").select("telegram_chat_id, whatsapp_number").eq("id", userId).single();
  if (data?.telegram_chat_id && env.telegramToken()) await telegramChannel(data.telegram_chat_id).text(text).catch(() => {});
  if (data?.whatsapp_number && whatsappEnabled()) await whatsappChannel(data.whatsapp_number).text(text).catch(() => {});
}
