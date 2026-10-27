import { Eye } from "lucide-react";
import { stopImpersonating } from "@/app/admin/actions";
import { impersonation } from "@/lib/session";
import { PlainButton } from "./button";

// Shown on every user-facing page while an admin is viewing the app as someone else.
// In the admin panel it's a reminder that "View as" is still switched on.
export async function ImpersonationBanner({ inAdmin = false }: { inAdmin?: boolean }) {
  const imp = await impersonation();
  if (!imp) return null;
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning px-4 py-2 text-center text-sm font-medium text-white dark:text-black">
      <Eye className="size-4 shrink-0" />
      <span>
        {inAdmin ? (
          <>The app is still open as <strong>{imp.target.full_name || imp.target.email}</strong>. <a href="/app" className="underline">Go back to it</a> or exit.</>
        ) : (
          <>Viewing as <strong>{imp.target.full_name || imp.target.email}</strong> ({imp.target.email}). Everything you do here happens on their account.</>
        )}
      </span>
      <form action={stopImpersonating}>
        <PlainButton type="submit" pending="Exiting…" className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">
          Exit to admin
        </PlainButton>
      </form>
    </div>
  );
}
