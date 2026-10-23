import { runAutoDraft } from "@/lib/engine/scheduler";
import { authorizeJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One workspace's daily draft, queued by the scheduler tick.
export async function POST(req: Request) {
  const auth = await authorizeJob(req);
  if (!auth.ok) return new Response("Unauthorized", { status: 401 });
  const { workspaceId } = JSON.parse(auth.body || "{}") as { workspaceId?: string };
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });
  await runAutoDraft(workspaceId);
  return Response.json({ ok: true });
}
