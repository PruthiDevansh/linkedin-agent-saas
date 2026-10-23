import type { ImageKind, Visual } from "../types";

export const VISUAL_INSTRUCTIONS = [
  "Also plan one image for the post, in a field called visual:",
  '"visual": {"type": "card" | "flowchart" | "quote" | "none", "title": string, "points": string[], "steps": string[], "quote": string}',
  "- title: the core message in at most 8 words.",
  "- points: exactly 3 key takeaways, each at most 9 words.",
  "- steps: if the post explains a process or sequence, 3 to 6 steps of at most 5 words each; otherwise [].",
  "- quote: the single most shareable sentence of the post, at most 20 words.",
  '- type: "flowchart" only when steps make sense, "quote" for opinion posts, "card" for most others.',
].join("\n");

const words = (s: string, max: number) => s.trim().split(/\s+/).slice(0, max).join(" ");
const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && !!s.trim()) : []);

// Clean up whatever the AI returned, so the image always renders well.
export function normalizeVisual(raw: unknown, fallbackTitle: string): Visual {
  const v = (raw ?? {}) as Record<string, unknown>;
  const title = words(typeof v.title === "string" && v.title.trim() ? v.title : fallbackTitle, 10);
  const points = list(v.points).slice(0, 3).map((p) => words(p, 12));
  const steps = list(v.steps).slice(0, 6).map((s) => words(s, 6));
  const quote = words(typeof v.quote === "string" ? v.quote : "", 24);

  let suggested: Visual["suggested"] =
    v.type === "flowchart" || v.type === "quote" || v.type === "none" ? v.type : "card";
  if (suggested === "flowchart" && steps.length < 3) suggested = "card";
  if (suggested === "quote" && !quote) suggested = "card";
  if (suggested === "card" && points.length === 0) suggested = quote ? "quote" : "none";
  return { suggested, title, points, steps, quote };
}

// The image kinds a draft can switch between.
export function availableKinds(visual: Visual | null, hasPhoto: boolean): ImageKind[] {
  const kinds: ImageKind[] = [];
  if (visual?.points.length) kinds.push("card");
  if ((visual?.steps.length ?? 0) >= 3) kinds.push("flowchart");
  if (visual?.quote) kinds.push("quote");
  if (hasPhoto) kinds.push("photo");
  kinds.push("none");
  return kinds;
}

export function nextImageKind(current: ImageKind, visual: Visual | null, hasPhoto: boolean): ImageKind {
  const kinds = availableKinds(visual, hasPhoto);
  return kinds[(kinds.indexOf(current) + 1) % kinds.length] ?? "none";
}

export const IMAGE_LABEL: Record<ImageKind, string> = {
  card: "Key takeaways card",
  flowchart: "Flowchart",
  quote: "Quote card",
  photo: "Your photo",
  none: "No image",
};
