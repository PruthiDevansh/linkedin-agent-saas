"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Slide } from "@/lib/types";

// Edits carousel slides and keeps them in a hidden JSON field for the form.
export function SlidesEditor({ initial, disabled }: { initial: Slide[]; disabled?: boolean }) {
  const [slides, setSlides] = useState<Slide[]>(initial);
  const update = (i: number, patch: Partial<Slide>) => setSlides((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setSlides((s) => {
      const next = [...s];
      const j = i + d;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-3">
      <input type="hidden" name="slides" value={JSON.stringify(slides)} />
      {slides.map((s, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
            <span>Slide {i + 1}{i === 0 ? " · cover" : i === slides.length - 1 ? " · call to action" : ""}</span>
            {!disabled && (
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="rounded p-1 hover:bg-surface" aria-label="Move up"><ArrowUp className="size-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} className="rounded p-1 hover:bg-surface" aria-label="Move down"><ArrowDown className="size-3.5" /></button>
                <button type="button" onClick={() => setSlides((x) => x.filter((_, j) => j !== i))} className="rounded p-1 text-danger hover:bg-surface" aria-label="Delete slide" disabled={slides.length <= 3}><Trash2 className="size-3.5" /></button>
              </span>
            )}
          </div>
          <input value={s.title} disabled={disabled} maxLength={90} onChange={(e) => update(i, { title: e.target.value })} className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold" />
          <textarea value={s.body} disabled={disabled} maxLength={260} rows={2} onChange={(e) => update(i, { body: e.target.value })} className="mt-2 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm" />
        </div>
      ))}
      {!disabled && slides.length < 10 && (
        <button type="button" onClick={() => setSlides((s) => [...s.slice(0, -1), { title: "New slide", body: "" }, ...s.slice(-1)])} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
          <Plus className="size-4" /> Add slide
        </button>
      )}
    </div>
  );
}
