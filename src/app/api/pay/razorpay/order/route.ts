import { createRazorpayOrder } from "@/lib/payments";
import { currentProfile } from "@/lib/session";

export async function POST() {
  const profile = await currentProfile();
  if (!profile) return Response.json({ error: "Please log in." }, { status: 401 });
  try {
    return Response.json(await createRazorpayOrder(profile.id));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not start payment." }, { status: 400 });
  }
}
