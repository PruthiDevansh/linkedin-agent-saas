"use client";

import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { useState, useTransition, type KeyboardEvent } from "react";
import { suggestTopicsForProfile } from "@/app/app/actions";
import { CATEGORY_IDS, cleanTopic, MAX_TOPICS, topicLabel } from "@/lib/engine/topics";
import { toast } from "./toaster";
import { cx } from "./ui";

const CHIP = "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm";

// Topics for daily drafts: tech presets, anything the user types, or AI ideas from their profile.
// Reads the About/Audience fields of the surrounding form so unsaved edits count.
export function TopicPicker({ initial, disabled }: { initial: string[]; disabled?: boolean }) {
  const [selected, setSelected] = useState(initial);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [suggesting, startSuggest] = useTransition();

  const has = (t: string) => selected.some((s) => s.toLowerCase() === t.toLowerCase());
  const full = selected.length >= MAX_TOPICS;

  function add(value: string) {
    const topic = cleanTopic(value);
    if (!topic || has(topic)) return;
    if (full) return toast(`You can pick up to ${MAX_TOPICS} topics.`, "error");
    setSelected((s) => [...s, topic]);
  }

  function addTyped() {
    add(text);
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit the whole settings form
      addTyped();
    }
  }

  function suggest(e: { currentTarget: HTMLButtonElement }) {
    const form = e.currentTarget.form;
    const field = (name: string) => String(form ? new FormData(form).get(name) ?? "" : "");
    startSuggest(async () => {
      const res = await suggestTopicsForProfile(field("about"), field("audience"));
      if (res.error) toast(res.error, "error");
      else setSuggested(res.topics ?? []);
    });
  }

  const ideas = suggested.filter((t) => !has(t));
  const presets = CATEGORY_IDS.filter((id) => !has(id));

  return (
    <div className="space-y-3">
      {selected.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}

      <div className="flex flex-wrap gap-2">
        {selected.map((t) => (
          <span key={t} className={cx(CHIP, "border-brand bg-brand-soft text-brand")}>
            {topicLabel(t)}
            {!disabled && (
              <button type="button" onClick={() => setSelected((s) => s.filter((x) => x !== t))} aria-label={`Remove ${topicLabel(t)}`} className="rounded-full p-0.5 hover:bg-brand/10">
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}
        {!selected.length && <span className="text-sm text-muted">No topics yet. Add your own or get suggestions below.</span>}
      </div>

      {!disabled && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              maxLength={50}
              placeholder="Add your own, e.g. Supreme Court judgments, nursing, NEET"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <button type="button" onClick={addTyped} disabled={!cleanTopic(text) || full} className={cx(CHIP, "border-border hover:bg-surface-2 disabled:opacity-50")}>
                <Plus className="size-4" /> Add
              </button>
              <button type="button" onClick={suggest} disabled={suggesting} className={cx(CHIP, "border-brand text-brand hover:bg-brand-soft disabled:opacity-60")}>
                {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {suggesting ? "Thinking…" : "Suggest from my profile"}
              </button>
            </div>
          </div>

          {ideas.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs text-muted">Suggested for you (based on About & Audience). Click to add:</div>
              <div className="flex flex-wrap gap-2">
                {ideas.map((t) => (
                  <button key={t} type="button" onClick={() => add(t)} className={cx(CHIP, "border-dashed border-brand text-brand hover:bg-brand-soft")}>
                    <Plus className="size-3.5" /> {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {presets.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs text-muted">Popular tech & business topics:</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((id) => (
                  <button key={id} type="button" onClick={() => add(id)} className={cx(CHIP, "border-border text-muted hover:bg-surface-2 hover:text-text")}>
                    <Plus className="size-3.5" /> {topicLabel(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted">One topic is used per day, in rotation. Custom topics pull fresh stories from Google News. Up to {MAX_TOPICS}.</p>
        </>
      )}
    </div>
  );
}
