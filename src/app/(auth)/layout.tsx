import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1f33] via-[#12395e] to-[#2557d6] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug">Approve one post from your phone with your morning chai. The agent does the research, writing and design.</p>
          <p className="mt-6 text-sm text-white/70">Daily drafts · Images & carousels · Best-time scheduling · Analytics</p>
        </div>
      </aside>
    </div>
  );
}
