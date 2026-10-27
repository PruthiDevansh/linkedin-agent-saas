"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// A thin bar at the top of the page while the next page loads, so every link click
// gets instant feedback (the page's loading skeleton follows right after).
export function NavProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // Navigation finished.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 300);
    return () => clearTimeout(t);
  }, [pathname, params]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    }
    // Forms that navigate with GET (search/filter) count too.
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      if (!e.defaultPrevented && form.method.toLowerCase() === "get" && !form.getAttribute("action")?.startsWith("javascript")) setState("loading");
    }
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  // Safety net: never leave the bar stuck.
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("idle"), 8000);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5" aria-hidden>
      <div className={state === "loading" ? "nav-progress h-full bg-brand" : "h-full w-full bg-brand opacity-0 transition-opacity duration-300"} />
    </div>
  );
}
