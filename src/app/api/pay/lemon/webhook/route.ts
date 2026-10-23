import { activatePro, verifyLemonWebhook } from "@/lib/payments";

// Lemon Squeezy -> Settings -> Webhooks: event "order_created", URL /api/pay/lemon/webhook.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyLemonWebhook(raw, req.headers.get("x-signature"))) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(raw) as {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: { id: string; attributes?: { status?: string; total?: number; currency?: string } };
  };
  const userId = event.meta?.custom_data?.user_id;
  if (event.meta?.event_name === "order_created" && event.data?.attributes?.status === "paid" && userId) {
    const a = event.data.attributes;
    await activatePro(userId, "lemonsqueezy", event.data.id, (a.total ?? 0) / 100, a.currency ?? "USD", event);
  }
  return Response.json({ ok: true });
}
