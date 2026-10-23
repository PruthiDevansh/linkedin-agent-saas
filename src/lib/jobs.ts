import { Receiver } from "@upstash/qstash";
import { env, secretMatches } from "./env";

// Background job endpoints accept either a QStash-signed request or the
// Vercel Cron bearer secret. Returns the raw body when allowed.
export async function authorizeJob(req: Request): Promise<{ ok: true; body: string } | { ok: false }> {
  const body = await req.text();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (env.cronSecret() && secretMatches(bearer, env.cronSecret())) return { ok: true, body };

  const signature = req.headers.get("upstash-signature");
  if (signature && env.qstashCurrentKey()) {
    const receiver = new Receiver({ currentSigningKey: env.qstashCurrentKey(), nextSigningKey: env.qstashNextKey() });
    const valid = await receiver.verify({ signature, body }).catch(() => false);
    if (valid) return { ok: true, body };
  }
  return { ok: false };
}
