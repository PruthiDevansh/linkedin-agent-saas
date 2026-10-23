import { Client } from "@upstash/qstash";
import { env } from "../env";
import { db } from "../supabase";
import type { Profile, Workspace } from "../types";
import { notifyDraft, notifyText } from "../channels/chat";
import { createNewsDraft, publishDraft } from "./drafts";

const BUDGET_MS = 45_000; // stay under Vercel's 60s function limit

function localHour(timezone: string, now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now));
}

function qstash(): Client | null {
  return env.qstashToken() ? new Client({ token: env.qstashToken() }) : null;
}

// Run one workspace's daily draft. Called inline or as its own QStash job.
export async function runAutoDraft(workspaceId: string) {
  const { data: ws } = await db().from("workspaces").select("*").eq("id", workspaceId).single();
  if (!ws) return;
  const { data: owner } = await db().from("profiles").select("*").eq("id", (ws as Workspace).owner_id).single();
  const profile = owner as Profile;
  if (!profile || profile.status !== "active") return;
  try {
    const draft = await createNewsDraft(profile, ws.id);
    if (draft) await notifyDraft(draft);
  } catch (err) {
    await notifyText(profile.id, `⚠️ Today's draft failed: ${err instanceof Error ? err.message : err}`);
  }
}

// Called every 15 minutes (QStash schedule) and once a day (Vercel cron fallback).
export async function runTick() {
  const started = Date.now();
  const summary = { published: 0, failed: 0, drafted: 0, queued: 0 };

  // 1. Publish scheduled posts that are due.
  const { data: due } = await db()
    .from("drafts")
    .select("id, created_by")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(25);
  for (const d of due ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    const result = await publishDraft(d.id, d.created_by);
    if (result.ok) summary.published++;
    else summary.failed++;
    if (d.created_by) await notifyText(d.created_by, result.ok ? `✅ Scheduled post is live:\n${result.url}` : `⚠️ Scheduled post failed: ${result.message}`);
  }

  // 2. Daily drafts for workspaces whose chosen hour is now and that have none today.
  const { data: workspaces } = await db().from("workspaces").select("id, timezone, draft_hour").eq("auto_draft", true);
  const since = new Date(Date.now() - 20 * 3600_000).toISOString();
  const client = qstash();
  for (const ws of workspaces ?? []) {
    if (localHour(ws.timezone) !== ws.draft_hour) continue;
    const { count } = await db().from("drafts").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("origin", "news").gte("created_at", since);
    if (count) continue;
    if (client) {
      await client.publishJSON({ url: `${env.appUrl()}/api/jobs/draft`, body: { workspaceId: ws.id } });
      summary.queued++;
    } else if (Date.now() - started < BUDGET_MS) {
      await runAutoDraft(ws.id);
      summary.drafted++;
    }
  }
  return summary;
}

// Admin button: create the 15-minute QStash schedule.
export async function ensureSchedule() {
  const client = qstash();
  if (!client) throw new Error("Add QSTASH_TOKEN first.");
  const destination = `${env.appUrl()}/api/jobs/tick`;
  const existing = await client.schedules.list();
  if (existing.some((s) => s.destination === destination)) return "already-running";
  await client.schedules.create({ destination, cron: "*/15 * * * *" });
  return "created";
}
