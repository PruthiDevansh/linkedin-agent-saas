import { decrypt } from "../crypto";
import { env } from "../env";
import { effectivePlan } from "../settings";
import type { Profile, Slide, Visual, Workspace } from "../types";
import type { Candidate } from "./sources";
import { CATEGORIES, type CategoryId } from "./topics";
import { normalizeVisual, VISUAL_INSTRUCTIONS } from "./visual";

const MAX_POST_CHARS = 2800; // LinkedIn allows 3000

export class AiKeyMissingError extends Error {}

// Pro users run on the platform key; free users bring their own Gemini key.
export function aiKeyFor(profile: Profile): string {
  if (effectivePlan(profile) === "pro" && env.geminiKey()) return env.geminiKey();
  if (profile.gemini_key_enc) return decrypt(profile.gemini_key_enc);
  throw new AiKeyMissingError(
    "Add your free Gemini API key in Settings → AI key (or upgrade to Pro) to generate posts.",
  );
}

function styleRules(ws: Workspace, authorName: string) {
  return [
    `You write LinkedIn posts for ${authorName || "the author"}.${ws.about ? ` About them: ${ws.about}` : ""}`,
    ws.audience ? `Audience: ${ws.audience}.` : "",
    `Voice: ${ws.voice}`,
    "No hype words: no 'game-changer', 'revolutionary', 'delve', 'unleash', 'in today's fast-paced world'. At most 2 emojis.",
    "",
    "How to write a post that spreads on LinkedIn:",
    "- First line is a hook under 12 words that makes people click 'see more'. No clickbait lies.",
    "- 120 to 220 words. Short lines with blank lines between them.",
    "- One clear opinion or lesson, not a summary.",
    "- End with a simple question that invites comments.",
    "- 3 to 5 relevant hashtags on the last line. No links in the post.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ------------------------------------------------------------------ Gemini

class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
const isBusy = (err: unknown) => err instanceof GeminiError && [0, 429, 500, 503].includes(err.status);

async function callModel(key: string, model: string, system: string, prompt: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => {
    throw new GeminiError(`AI did not answer in time (${err instanceof Error ? err.message : err})`, 0);
  });
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = data.error?.message ?? "unknown";
    if (res.status === 400 && /API key/i.test(msg)) throw new AiKeyMissingError("Your Gemini API key is not valid. Update it in Settings.");
    throw new GeminiError(`AI error ${res.status}: ${msg}`, res.status);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("The AI returned an empty answer.");
  return text;
}

// Main model gets one short chance, then the faster lite model. Max ~35s, so
// with news fetching (~10s) a request always fits Vercel's 60s limit.
async function callAi(key: string, system: string, prompt: string): Promise<unknown> {
  const plan = [
    { model: env.geminiModel(), timeoutMs: 14_000 },
    { model: env.geminiFallbackModel(), timeoutMs: 20_000 },
  ];
  let lastError: unknown;
  for (const { model, timeoutMs } of plan) {
    try {
      const raw = await callModel(key, model, system, prompt, timeoutMs);
      return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch (err) {
      if (err instanceof SyntaxError) {
        lastError = err; // malformed JSON: try the next attempt
        continue;
      }
      if (!isBusy(err)) throw err;
      lastError = err;
      console.warn(`AI ${model} busy:`, (err as Error).message);
    }
  }
  throw new Error(`The AI is overloaded right now, please try again in a few minutes. (${(lastError as Error)?.message})`);
}

// ------------------------------------------------------------------ writers

export type NewsPost = { topic: string; sourceTitle: string; sourceUrl: string; post: string; visual: Visual };

export async function writeNewsPost(
  key: string,
  ws: Workspace,
  authorName: string,
  category: CategoryId,
  candidates: Candidate[],
  trending: string[],
): Promise<NewsPost> {
  const cat = CATEGORIES[category];
  const system = [
    styleRules(ws, authorName),
    "",
    `Today's theme: ${cat.label}. ${cat.angle}`,
    "Facts: use only facts from the headlines and snippets given. Never invent numbers, names, quotes or dates. If unsure, write it as an opinion or question.",
  ].join("\n");

  const list = candidates
    .map((c, i) => `${i + 1}. ${c.title}\n   source: ${c.source}${c.points ? ` (${c.points} HN points)` : ""}\n   url: ${c.url}${c.snippet ? `\n   snippet: ${c.snippet}` : ""}`)
    .join("\n");
  const prompt = [
    "Today's fresh headlines for this theme:",
    list,
    trending.length ? `\nTop Google searches in India today (use only if truly related): ${trending.join(", ")}` : "",
    "\nPick the ONE headline most likely to get engagement from this audience and write the post about it.",
    'Reply with JSON only: {"topic": string, "sourceTitle": string, "sourceUrl": string, "post": string, "visual": object}',
    "sourceTitle and sourceUrl must be copied exactly from the chosen headline.",
    "",
    VISUAL_INSTRUCTIONS,
  ].join("\n");

  const json = (await callAi(key, system, prompt)) as Record<string, unknown>;
  const post = typeof json.post === "string" ? json.post.trim() : "";
  if (!post) throw new Error("The AI answer had no post text. Please try again.");
  // The source must be one of our headlines, so the user can verify it.
  const chosen = candidates.find((c) => c.url === json.sourceUrl) ?? candidates.find((c) => c.title === json.sourceTitle) ?? candidates[0];
  const topic = (typeof json.topic === "string" && json.topic.trim()) || chosen.title;
  return { topic, sourceTitle: chosen.title, sourceUrl: chosen.url, post: post.slice(0, MAX_POST_CHARS), visual: normalizeVisual(json.visual, topic) };
}

export async function writeIdeaPost(key: string, ws: Workspace, authorName: string, idea: string) {
  const system = [
    styleRules(ws, authorName),
    "",
    "The author gives you a short idea, note or experience. Turn it into an engaging first-person post.",
    "Keep their meaning and opinion. Add a strong hook, structure and a clear takeaway.",
    "Use only facts in the idea. Never invent numbers, names, companies, quotes or personal stories.",
  ].join("\n");
  const prompt = [`Idea: ${idea}`, "", 'Reply with JSON only: {"post": string, "visual": object}', "", VISUAL_INSTRUCTIONS].join("\n");
  const json = (await callAi(key, system, prompt)) as Record<string, unknown>;
  const post = typeof json.post === "string" ? json.post.trim() : "";
  if (!post) throw new Error("The AI answer had no post text. Please try again.");
  return { post: post.slice(0, MAX_POST_CHARS), visual: normalizeVisual(json.visual, idea) };
}

// A swipeable carousel: 6-8 slides plus a short caption for the post.
export async function writeCarousel(key: string, ws: Workspace, authorName: string, subject: string) {
  const system = [
    styleRules(ws, authorName),
    "",
    "Create a LinkedIn carousel (a swipeable PDF). Slide 1 is a bold hook. Middle slides teach one idea each.",
    "Last slide is a call to action (follow, comment, save). Slide titles at most 8 words, bodies at most 30 words.",
    "Use only facts in the subject. Never invent numbers or quotes.",
  ].join("\n");
  const prompt = [
    `Subject: ${subject}`,
    "",
    'Reply with JSON only: {"caption": string, "slides": [{"title": string, "body": string}]}',
    "caption: a short LinkedIn post (60 to 120 words) that introduces the carousel, with 3 hashtags.",
    "slides: 6 to 8 items.",
  ].join("\n");
  const json = (await callAi(key, system, prompt)) as { caption?: string; slides?: Slide[] };
  const slides = (json.slides ?? [])
    .filter((s) => s && typeof s.title === "string")
    .slice(0, 10)
    .map((s) => ({ title: s.title.trim().slice(0, 90), body: (s.body ?? "").trim().slice(0, 260) }));
  if (slides.length < 3 || !json.caption) throw new Error("The AI could not build the carousel. Please try again.");
  return { caption: json.caption.trim().slice(0, MAX_POST_CHARS), slides };
}

// Quick key check used when a user saves their Gemini key.
export async function testAiKey(key: string): Promise<void> {
  await callModel(key, env.geminiFallbackModel(), "Reply with JSON.", 'Reply {"ok": true}', 20_000);
}
