import { getDraft } from "@/lib/engine/drafts";
import { authorName, draftImage } from "@/lib/engine/media";
import { renderSlide } from "@/lib/engine/image";
import { currentProfile } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { Workspace } from "@/lib/types";

export const dynamic = "force-dynamic";

// Image preview for the portal. Only members of the draft's workspace can see it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await currentProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  const draft = await getDraft((await params).id);
  if (!draft) return new Response("Not found", { status: 404 });
  const { data: member } = await db().from("workspace_members").select("role").eq("workspace_id", draft.workspace_id).eq("user_id", profile.id).maybeSingle();
  if (!member && profile.role !== "admin") return new Response("Not found", { status: 404 });

  const { data: ws } = await db().from("workspaces").select("*").eq("id", draft.workspace_id).single();
  const slide = new URL(request.url).searchParams.get("slide");
  let bytes: ArrayBuffer | null;
  if (slide !== null && draft.slides?.length) {
    const i = Math.min(Math.max(0, Number(slide) || 0), draft.slides.length - 1);
    bytes = await renderSlide(draft.slides, i, (ws as Workspace).image_theme, await authorName(draft.created_by));
  } else {
    bytes = await draftImage(draft, ws as Workspace);
  }
  if (!bytes) return new Response("No image", { status: 404 });
  // The URL carries ?v=<updated_at>, so a new version gets a new URL.
  return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
}
