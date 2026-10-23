import { env } from "../env";
import type { ChatButton, ChatChannel } from "./types";

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${env.telegramToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`);
  return data.result;
}

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: { file_id: string }[];
  };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

export function telegramChannel(chatId: number): ChatChannel {
  return {
    kind: "telegram",
    async text(text) {
      await call("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
    },
    async ask(text) {
      await call("sendMessage", { chat_id: chatId, text, reply_markup: { force_reply: true } });
    },
    async draft(text, buttons, image) {
      let imageId: number | undefined;
      if (image) {
        const form = new FormData();
        form.append("chat_id", String(chatId));
        form.append("caption", "🖼 Image for the draft below");
        form.append(image.kind === "pdf" ? "document" : "photo", new Blob([image.bytes as BlobPart], { type: image.kind === "pdf" ? "application/pdf" : "image/png" }), image.kind === "pdf" ? "carousel.pdf" : "post.png");
        const res = await fetch(`https://api.telegram.org/bot${env.telegramToken()}/${image.kind === "pdf" ? "sendDocument" : "sendPhoto"}`, { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
        imageId = data.result?.message_id;
      }
      const rows: ChatButton[][] = [];
      for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
      const msg = await call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: text.slice(0, 4000),
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.label, callback_data: b.id }))) },
      });
      return { telegram: { textId: msg.message_id, imageId } };
    },
    async clear(refs) {
      const t = refs.telegram;
      if (t?.textId) await call("editMessageReplyMarkup", { chat_id: chatId, message_id: t.textId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      if (t?.imageId) await call("deleteMessage", { chat_id: chatId, message_id: t.imageId }).catch(() => {});
    },
  };
}

export async function answerCallback(id: string, text?: string) {
  await call("answerCallbackQuery", { callback_query_id: id, text }).catch(() => {});
}

export async function registerTelegramWebhook() {
  const url = `${env.appUrl()}/api/telegram/webhook`;
  await call("setWebhook", { url, secret_token: env.telegramWebhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  await call("setMyCommands", {
    commands: [
      { command: "draft", description: "Make a post from today's news" },
      { command: "write", description: "Turn your idea into a post" },
      { command: "carousel", description: "Make a swipeable carousel" },
      { command: "topics", description: "List topics" },
      { command: "status", description: "Your account and LinkedIn status" },
      { command: "help", description: "How this works" },
    ],
  });
  return url;
}
