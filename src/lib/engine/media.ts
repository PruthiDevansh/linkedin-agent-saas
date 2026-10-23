import { env } from "../env";
import { db } from "../supabase";
import type { Draft, Workspace } from "../types";
import { renderCarouselPdf, renderPostImage } from "./image";

export async function authorName(userId: string | null): Promise<string> {
  if (!userId) return env.appName();
  const { data } = await db().from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return data?.full_name || data?.email?.split("@")[0] || env.appName();
}

// Photos uploaded in the portal live in the private "media" bucket.
export async function savePhoto(path: string, bytes: ArrayBuffer, contentType: string) {
  const { error } = await db().storage.from("media").upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Could not save the photo: ${error.message}`);
}

async function telegramPhoto(fileId: string): Promise<ArrayBuffer> {
  const token = env.telegramToken();
  const meta = (await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`).then((r) => r.json())) as {
    result?: { file_path: string };
  };
  if (!meta.result) throw new Error("Could not find the Telegram photo.");
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${meta.result.file_path}`);
  if (!res.ok) throw new Error("Could not download the Telegram photo.");
  return res.arrayBuffer();
}

// PNG/JPEG bytes for a single-image post, or null when the post has no image.
export async function draftImage(draft: Draft, ws: Workspace): Promise<ArrayBuffer | null> {
  if (draft.format === "carousel") return null;
  if (draft.image_kind === "photo") {
    if (draft.photo_path) {
      const { data, error } = await db().storage.from("media").download(draft.photo_path);
      if (error) throw new Error(`Could not load the photo: ${error.message}`);
      return data.arrayBuffer();
    }
    if (draft.telegram_photo_id) return telegramPhoto(draft.telegram_photo_id);
    return null;
  }
  if ((draft.image_kind === "card" || draft.image_kind === "flowchart" || draft.image_kind === "quote") && draft.visual) {
    return renderPostImage(draft.image_kind, draft.visual, ws.image_theme, await authorName(draft.created_by));
  }
  return null;
}

export async function draftCarouselPdf(draft: Draft, ws: Workspace): Promise<Uint8Array | null> {
  if (draft.format !== "carousel" || !draft.slides?.length) return null;
  return renderCarouselPdf(draft.slides, ws.image_theme, await authorName(draft.created_by));
}
