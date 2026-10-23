import { activatePro, verifyRazorpayWebhook } from "@/lib/payments";
import { db } from "@/lib/supabase";

// Razorpay Dashboard -> Webhooks: event "order.paid", URL /api/pay/razorpay/webhook.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"))) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(raw) as { event: string; payload?: { order?: { entity?: { id: string; amount: number; currency: string; notes?: { user_id?: string } } } } };
  if (event.event === "order.paid") {
    const order = event.payload?.order?.entity;
    const userId = order?.notes?.user_id;
    if (order && userId) await activatePro(userId, "razorpay", order.id, order.amount / 100, order.currency, event);
  }
  if (event.event === "payment.failed") {
    const ref = (event.payload as { payment?: { entity?: { order_id?: string } } })?.payment?.entity?.order_id;
    if (ref) await db().from("payments").update({ status: "failed" }).eq("provider", "razorpay").eq("provider_ref", ref).neq("status", "paid");
  }
  return Response.json({ ok: true });
}
