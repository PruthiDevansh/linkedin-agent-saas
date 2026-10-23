"use client";

import { CreditCard, Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay. Check your connection."));
    document.body.appendChild(s);
  });
}

type Props = { razorpay: boolean; lemon: boolean; priceInr: number; priceUsd: number; period: string; email: string; name: string; appName: string };

export function PayButtons({ razorpay, lemon, priceInr, priceUsd, period, email, name, appName }: Props) {
  const [busy, setBusy] = useState<"rzp" | "lemon" | null>(null);
  const [error, setError] = useState("");

  async function payRazorpay() {
    setBusy("rzp");
    setError("");
    try {
      await loadRazorpay();
      const res = await fetch("/api/pay/razorpay/order", { method: "POST" });
      const order = (await res.json()) as { orderId?: string; amount?: number; keyId?: string; error?: string };
      if (!order.orderId) throw new Error(order.error ?? "Could not start payment.");
      const rzp = new window.Razorpay!({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: appName,
        description: `Pro plan (${period})`,
        prefill: { email, name },
        theme: { color: "#2557d6" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await fetch("/api/pay/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
          if (v.ok) window.location.href = "/app?ok=Payment+received.+Welcome+to+Pro!";
          else setError("Payment received but could not be verified yet. It will activate within a minute; refresh soon.");
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setBusy(null);
    }
  }

  async function payLemon() {
    setBusy("lemon");
    setError("");
    const res = await fetch("/api/pay/lemon/checkout", { method: "POST" });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else {
      setError(data.error ?? "Could not start checkout.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {razorpay && (
        <Button onClick={payRazorpay} disabled={!!busy} className="w-full py-2.5">
          {busy === "rzp" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Pay ₹{priceInr} · UPI, cards, netbanking
        </Button>
      )}
      {lemon && (
        <Button variant="secondary" onClick={payLemon} disabled={!!busy} className="w-full py-2.5">
          {busy === "lemon" ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />} Pay ${priceUsd} · international cards
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
