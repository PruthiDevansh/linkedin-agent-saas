import { handleAction, handlePhoto, handleText, linkAccount } from "@/lib/channels/chat";
import { answerCallback, telegramChannel, type TelegramUpdate } from "@/lib/channels/telegram";
import { env, secretMatches } from "@/lib/env";
import { db } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), env.telegramWebhookSecret())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const update = (await req.json()) as TelegramUpdate;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!chatId) return Response.json({ ok: true });
  const ch = telegramChannel(chatId);

  try {
    const { data } = await db().from("profiles").select("*").eq("telegram_chat_id", chatId).maybeSingle();
    const profile = data as Profile | null;

    // Linking: /start CODE (from the deep link in Settings).
    const text = update.message?.text?.trim() ?? "";
    const startCode = text.match(/^\/start\s+([A-Z0-9]{6,12})$/i)?.[1];
    if (startCode) {
      const linked = await linkAccount(startCode, { telegramChatId: chatId });
      if (linked) {
        await ch.text(`✅ Linked to ${linked.email}! Send /draft to get your first post, or /help.`);
        return Response.json({ ok: true });
      }
    }
    if (!profile) {
      await ch.text(`👋 Link this chat to your account first: open ${env.appUrl()}/app/settings#channels and tap "Open Telegram & link".`);
      return Response.json({ ok: true });
    }
    if (profile.status !== "active") {
      await ch.text(`Your account isn't active. Open ${env.appUrl()}/onboarding`);
      return Response.json({ ok: true });
    }

    if (update.callback_query) {
      const [action, id] = (update.callback_query.data ?? "").split(":");
      await answerCallback(update.callback_query.id, action === "post" ? "Posting…" : undefined);
      await handleAction(profile, ch, action, id);
    } else if (update.message?.photo?.length) {
      await handlePhoto(profile, ch, { telegramId: update.message.photo.at(-1)!.file_id }, update.message.caption ?? "");
    } else if (text) {
      await handleText(profile, ch, text);
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }
  // Always 200 so Telegram doesn't resend the update.
  return Response.json({ ok: true });
}
