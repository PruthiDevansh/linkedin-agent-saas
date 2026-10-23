import { activatePro, verifyRazorpayCheckout } from "@/lib/payments";
import { currentProfile } from "@/lib/session";
import { db } from "@/lib/supabase";

// Called by the browser after Razorpay Checkout succeeds. The signature proves
// the payment is real; the webhook does the same job if the browser closes early.
export async function POST(req: Request) {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: "Please log in." }, { status: 401 });
  const body = (await req.json()) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!orderId || !paymentId || !signature || !verifyRazorpayCheckout(orderId, paymentId, signature)) {
    return Response.json({ error: "Invalid payment signature." }, { status: 400 });
  }
  const { data: order } = await db().from("payments").select("user_id, amount, currency").eq("provider", "razorpay").eq("provider_ref", orderId).maybeSingle();
  if (!order || order.user_id !== profile.id) return Response.json({ error: "Order not found." }, { status: 404 });
  await activatePro(profile.id, "razorpay", orderId, Number(order.amount), order.currency, { paymentId });
  return Response.json({ ok: true });
}
