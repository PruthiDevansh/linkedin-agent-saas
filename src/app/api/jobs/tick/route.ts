import { runTick } from "@/lib/engine/scheduler";
import { authorizeJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Every 15 min via QStash (and daily via Vercel Cron as a fallback).
async function handle(req: Request) {
  const auth = await authorizeJob(req);
  if (!auth.ok) return new Response("Unauthorized", { status: 401 });
  return Response.json({ ok: true, ...(await runTick()) });
}

export const GET = handle;
export const POST = handle;
