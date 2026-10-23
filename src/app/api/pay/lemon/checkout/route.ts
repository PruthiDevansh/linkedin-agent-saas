import { createLemonCheckout } from "@/lib/payments";
import { currentProfile } from "@/lib/session";

export async function POST() {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: "Please log in." }, { status: 401 });
  try {
    return Response.json({ url: await createLemonCheckout(profile.id, profile.email) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not start checkout." }, { status: 400 });
  }
}
