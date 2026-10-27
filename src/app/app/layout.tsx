import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { Shell } from "@/components/shell";
import { Notice, PlainButton } from "@/components/ui";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { effectivePlan, getSettings, needsOwnKey } from "@/lib/settings";
import { signOut } from "../(auth)/actions";
import { switchWorkspace } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireActiveUser();
  const [ws, settings] = await Promise.all([currentWorkspace(profile, (await cookies()).get("ws")?.value), getSettings()]);
  const plan = effectivePlan(profile);
  const needsKey = needsOwnKey(settings, profile);

  const switcher =
    ws.workspaces.length > 1 ? (
      <form action={switchWorkspace}>
        <select
          name="workspace"
          defaultValue={ws.workspace.id}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium"
          aria-label="Workspace"
        >
          {ws.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <PlainButton type="submit" className="mt-1 w-full text-xs text-muted hover:text-text">Switch workspace</PlainButton>
      </form>
    ) : (
      <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium">{ws.workspace.name}</div>
    );

  return (
    <Shell
      area="app"
      logo={<Logo href="/app" />}
      user={{ name: profile.full_name, email: profile.email, plan, isAdmin: profile.role === "admin" }}
      workspaceSwitcher={switcher}
      banner={<ImpersonationBanner />}
      signOut={signOut}
    >
      {settings.announcement && <div className="mb-4"><Notice>{settings.announcement}</Notice></div>}
      {needsKey && (
        <div className="mb-6">
          <Notice tone="warning">
            Add your free Gemini API key to start generating posts.{" "}
            <Link href="/app/settings#ai" className="font-semibold underline">Add key</Link>
            {(settings.razorpay_enabled || settings.lemonsqueezy_enabled) && (
              <>
                {" "}or <Link href="/onboarding" className="font-semibold underline">upgrade to Pro</Link> and skip this.
              </>
            )}
          </Notice>
        </div>
      )}
      {children}
    </Shell>
  );
}
