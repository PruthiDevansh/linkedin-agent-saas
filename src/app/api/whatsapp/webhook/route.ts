import { handleAction, handlePhoto, handleText, linkAccount } from "@/lib/channels/chat";
import { downloadWhatsAppMedia, verifyWhatsAppSignature, whatsappChannel, whatsappEnabled } from "@/lib/channels/whatsapp";
import { env, secretMatches } from "@/lib/env";
import { db } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta calls GET once to verify the webhook URL.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && secretMatches(p.get("hub.verify_token"), env.whatsappVerifyToken())) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string } };
  image?: { id: string; caption?: string };
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!whatsappEnabled() || !verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = JSON.parse(raw) as { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };
  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    const ch = whatsappChannel(m.from);
    try {
      const text = m.text?.body?.trim() ?? "";
      const linkCode = text.match(/^link\s+([A-Z0-9]{6,12})$/i)?.[1];
      if (linkCode) {
        const linked = await linkAccount(linkCode, { whatsappNumber: m.from });
        await ch.text(linked ? `✅ Linked to ${linked.email}! Send "draft" for your first post, or "help".` : "That code didn't work. Get a new one in Settings.");
        continue;
      }
      const { data } = await db().from("profiles").select("*").eq("whatsapp_number", m.from).maybeSingle();
      const profile = data as Profile | null;
      if (!profile) {
        await ch.text(`👋 Link WhatsApp first: open ${env.appUrl()}/app/settings#channels, get a code, then send "link CODE" here.`);
        continue;
      }
      if (profile.status !== "active") {
        await ch.text(`Your account isn't active. Open ${env.appUrl()}/onboarding`);
        continue;
      }
      if (m.type === "interactive" && m.interactive?.button_reply) {
        const [action, id] = m.interactive.button_reply.id.split(":");
        await handleAction(profile, ch, action, id);
      } else if (m.type === "image" && m.image) {
        const { bytes, mime } = await downloadWhatsAppMedia(m.image.id);
        await handlePhoto(profile, ch, { bytes, mime }, m.image.caption ?? "");
      } else if (text) {
        await handleText(profile, ch, text);
      }
    } catch (err) {
      console.error("WhatsApp webhook error:", err);
    }
  }
  return Response.json({ ok: true });
}
