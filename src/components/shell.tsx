"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Link2,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PlainButton } from "./button";
import { cx } from "./ui";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/create", label: "Create", icon: Sparkles },
  { href: "/app/drafts", label: "Posts", icon: FileText },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/inspiration", label: "Inspiration", icon: Lightbulb },
  { href: "/app/accounts", label: "Accounts & team", icon: Link2 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/invites", label: "Invites", icon: UserPlus },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/content", label: "All posts", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/library", label: "Library", icon: BookOpen },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type Props = {
  logo: ReactNode;
  user: { name: string; email: string; plan: string; isAdmin: boolean };
  workspaceSwitcher?: ReactNode;
  /** Full-width strip above everything, e.g. "Viewing as …". */
  banner?: ReactNode;
  signOut: () => Promise<void>;
  area: "app" | "admin";
  children: ReactNode;
};

export function Shell({ logo, user, workspaceSwitcher, banner, signOut, area, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = area === "admin" ? ADMIN_NAV : NAV;
  const isActive = (href: string) => (href === "/app" || href === "/admin" ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {workspaceSwitcher && <div className="mb-3">{workspaceSwitcher}</div>}
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}
            <Icon className={cx("size-4.5 shrink-0 transition-transform", !active && "group-hover:scale-105")} />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4">
        {user.isAdmin && (
          <Link
            href={area === "admin" ? "/app" : "/admin"}
            onClick={() => setOpen(false)}
            className="mb-2 flex items-center gap-3 rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-brand"
          >
            <Shield className="size-4.5" />
            {area === "admin" ? "Back to app" : "Admin panel"}
          </Link>
        )}
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-strong text-sm font-semibold text-white">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name || user.email}</div>
            <div className="truncate text-xs capitalize text-muted">{user.plan} plan</div>
          </div>
          <form action={signOut}>
            <PlainButton type="submit" className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-text" aria-label="Log out" title="Log out">
              <LogOut className="size-4" />
            </PlainButton>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {banner}
      <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-16 items-center border-b border-border px-5">{logo}</div>
          {nav}
        </aside>

        {/* Mobile top bar + drawer */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
          {logo}
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-surface shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                {logo}
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </aside>
          </div>
        )}

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div key={pathname} className="page-in mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
