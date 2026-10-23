import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Payments" };

export default async function AdminPayments() {
  await requireAdmin();
  const { data } = await db().from("payments").select("*, profiles(email, full_name)").order("created_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  const paid = rows.filter((p) => p.status === "paid");
  const total = (cur: string) => paid.filter((p) => p.currency === cur).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <PageHeader title="Payments" description="Latest 300 payments" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Paid (INR)" value={`₹${Math.round(total("INR")).toLocaleString("en-IN")}`} />
        <Stat label="Paid (USD)" value={`$${total("USD").toFixed(2)}`} />
        <Stat label="Successful" value={paid.length} />
        <Stat label="Failed / abandoned" value={rows.filter((p) => p.status !== "paid").length} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Provider</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => {
                const u = p.profiles as { email?: string; full_name?: string } | null;
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-muted">{formatInZone(p.created_at, "Asia/Kolkata")}</td>
                    <td className="px-3 py-3">{p.user_id ? <Link href={`/admin/users/${p.user_id}`} className="hover:underline">{u?.full_name || u?.email}</Link> : "—"}</td>
                    <td className="px-3 py-3 capitalize">{p.provider}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.currency} {Number(p.amount).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3"><Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
