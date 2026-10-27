"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };

let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

/** Show a toast from any client component. */
export function toast(text: string, tone: Toast["tone"] = "success") {
  const t = { id: nextId++, tone, text };
  listeners.forEach((l) => l(t));
}

const ICON = { success: CheckCircle2, error: XCircle, info: Info };
const TONE = { success: "text-success", error: "text-danger", info: "text-brand" };

// Turns the ?ok= / ?error= that server actions redirect with into toasts,
// then removes them from the address bar so a refresh doesn't repeat them.
export function Toaster() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const add = (t: Toast) => {
      setToasts((list) => [...list.slice(-3), t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), t.tone === "error" ? 8000 : 4500);
    };
    listeners.add(add);
    return () => void listeners.delete(add);
  }, []);

  useEffect(() => {
    const ok = params.get("ok");
    const error = params.get("error");
    if (!ok && !error) return;
    if (error) toast(error, "error");
    else if (ok) toast(ok, "success");
    const rest = new URLSearchParams(params);
    rest.delete("ok");
    rest.delete("error");
    const qs = rest.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [params, pathname]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg">
            <Icon className={`mt-0.5 size-4.5 shrink-0 ${TONE[t.tone]}`} />
            <p className="min-w-0 flex-1 leading-snug">{t.text}</p>
            <button type="button" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} className="-mr-1 rounded p-0.5 text-muted hover:text-text" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
