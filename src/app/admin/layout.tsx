import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { signOut } from "../(auth)/actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <Shell
      area="admin"
      logo={<span className="inline-flex items-center gap-2"><Logo href="/admin" /><Badge tone="warning">Admin</Badge></span>}
      user={{ name: admin.full_name, email: admin.email, plan: "admin", isAdmin: true }}
      banner={<ImpersonationBanner inAdmin />}
      signOut={signOut}
    >
      {children}
    </Shell>
  );
}
