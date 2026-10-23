import { createHmac } from "node:crypto";
import { env, secretMatches } from "../env";
import type { ChatChannel } from "./types";

// WhatsApp Cloud API (Meta). Note: outside the 24-hour window after the user's
// last message, Meta only allows pre-approved template messages, so daily
// drafts reach WhatsApp users who chatted in the last 24h; others get them on Telegram/portal.

const GRAPH = "https://graph.facebook.com/v23.0";

export function whatsappEnabled() {
  return !!(env.whatsappToken() && env.whatsappPhoneNumberId());
}

async function send(to: string, payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.whatsappToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`WhatsApp send failed: ${data.error?.message ?? res.status}`);
  return data.messages?.[0]?.id;
}

async function uploadMedia(bytes: ArrayBuffer | Uint8Array, mime: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId()}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.whatsappToken()}` },
    body: form,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!data.id) throw new Error(`WhatsApp media upload failed: ${data.error?.message ?? res.status}`);
  return data.id;
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const meta = (await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${env.whatsappToken()}` } }).then((r) => r.json())) as {
    url?: string;
    mime_type?: string;
  };
  if (!meta.url) throw new Error("Could not find the WhatsApp photo.");
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${env.whatsappToken()}` } });
  return { bytes: await res.arrayBuffer(), mime: meta.mime_type ?? "image/jpeg" };
}

export function whatsappChannel(to: string): ChatChannel {
  return {
    kind: "whatsapp",
    async text(text) {
      await send(to, { type: "text", text: { body: text.slice(0, 4096), preview_url: false } });
    },
    async ask(text) {
      await send(to, { type: "text", text: { body: text } });
    },
    async draft(text, buttons, image) {
      if (image) {
        const isPdf = image.kind === "pdf";
        const id = await uploadMedia(image.bytes, isPdf ? "application/pdf" : "image/png", isPdf ? "carousel.pdf" : "post.png");
        await send(to, isPdf ? { type: "document", document: { id, filename: "carousel.pdf" } } : { type: "image", image: { id } });
      }
      // Interactive bodies are limited to 1024 chars: send the full post first.
      await send(to, { type: "text", text: { body: text.slice(0, 4096), preview_url: false } });
      const messageId = await send(to, {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "What should I do with this draft? Or reply: edit, skip, image, idea <text>." },
          action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.label.slice(0, 20) } })) },
        },
      });
      return { whatsapp: { messageId } };
    },
    async clear() {
      // WhatsApp can't remove buttons from sent messages; stale taps are ignored safely.
    },
  };
}

// Meta signs every webhook with the app secret.
export function verifyWhatsAppSignature(rawBody: string, header: string | null): boolean {
  if (!env.whatsappAppSecret()) return false;
  const expected = `sha256=${createHmac("sha256", env.whatsappAppSecret()).update(rawBody).digest("hex")}`;
  return secretMatches(header, expected);
}
