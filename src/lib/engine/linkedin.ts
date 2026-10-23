import { decrypt } from "../crypto";
import { env } from "../env";
import type { LinkedInAccount } from "../types";

// ------------------------------------------------------------------ OAuth

const SCOPES = ["openid", "profile", "w_member_social"];

export function redirectUri() {
  return `${env.appUrl()}/api/linkedin/callback`;
}

export function authorizationUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.linkedinClientId(),
    redirect_uri: redirectUri(),
    state,
    scope: SCOPES.join(" "),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: env.linkedinClientId(),
      client_secret: env.linkedinClientSecret(),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`LinkedIn token exchange failed (HTTP ${res.status}): ${data.error ?? ""} ${data.error_description ?? ""}`.trim());
  }
  const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${data.access_token}` } });
  const profile = (await me.json()) as { sub?: string; name?: string };
  if (!me.ok || !profile.sub) throw new Error(`Could not read the LinkedIn profile (HTTP ${me.status}).`);
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 60 * 86400) * 1000),
    personUrn: `urn:li:person:${profile.sub}`,
    name: profile.name ?? "",
  };
}

// ------------------------------------------------------------------ Posting

// API versions (YYYYMM) retire after ~1 year: default to two months ago.
function apiVersion(): string {
  if (env.linkedinVersion()) return env.linkedinVersion();
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// "Little text": reserved characters must be escaped or the post is cut off.
const RESERVED = /[\\|{}@[\]()<>#*_~]/g;
const HASHTAG = /^#[\p{L}\p{N}]+$/u;
export function toLittleText(text: string): string {
  return text
    .split(/(#[\p{L}\p{N}]+)/u)
    .map((part) => (HASHTAG.test(part) ? `{hashtag|\\#|${part.slice(1)}}` : part.replace(RESERVED, (c) => `\\${c}`)))
    .join("");
}

export class LinkedInAuthError extends Error {}

type Auth = { token: string; urn: string };

function auth(account: LinkedInAccount): Auth {
  if (new Date(account.expires_at) <= new Date()) throw new LinkedInAuthError("LinkedIn login expired.");
  return { token: decrypt(account.access_token_enc), urn: account.person_urn };
}

function headers(a: Auth) {
  return {
    Authorization: `Bearer ${a.token}`,
    "Content-Type": "application/json",
    "LinkedIn-Version": apiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Images and documents share the same 3-step flow: init -> PUT bytes -> wait until AVAILABLE.
async function upload(a: Auth, kind: "images" | "documents", bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const init = await fetch(`https://api.linkedin.com/rest/${kind}?action=initializeUpload`, {
    method: "POST",
    headers: headers(a),
    body: JSON.stringify({ initializeUploadRequest: { owner: a.urn } }),
  });
  if (init.status === 401) throw new LinkedInAuthError("LinkedIn login expired.");
  if (!init.ok) throw new Error(`LinkedIn ${kind} upload failed to start (HTTP ${init.status}): ${(await init.text()).slice(0, 300)}`);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image?: string; document?: string } };
  const urn = value.image ?? value.document;
  if (!urn) throw new Error("LinkedIn did not return an upload id.");

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/octet-stream" },
    body: bytes as BodyInit,
  });
  if (!put.ok) throw new Error(`LinkedIn upload failed (HTTP ${put.status}).`);

  for (let i = 0; i < 15; i++) {
    const res = await fetch(`https://api.linkedin.com/rest/${kind}/${encodeURIComponent(urn)}`, { headers: headers(a) });
    if (res.ok) {
      const { status } = (await res.json()) as { status?: string };
      if (status === "AVAILABLE") break;
      if (status === "PROCESSING_FAILED") throw new Error("LinkedIn could not process the file.");
    }
    await sleep(1_000);
  }
  return urn;
}

export type Attachment =
  | { type: "image"; bytes: ArrayBuffer; altText: string }
  | { type: "document"; bytes: Uint8Array; title: string };

export async function publish(account: LinkedInAccount, text: string, attachment?: Attachment) {
  const a = auth(account);
  let content: Record<string, unknown> | undefined;
  if (attachment?.type === "image") {
    content = { media: { id: await upload(a, "images", attachment.bytes), altText: attachment.altText.slice(0, 300) } };
  } else if (attachment?.type === "document") {
    content = { media: { id: await upload(a, "documents", attachment.bytes), title: attachment.title.slice(0, 120) } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: headers(a),
    body: JSON.stringify({
      author: a.urn,
      commentary: toLittleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (res.status === 401) throw new LinkedInAuthError("LinkedIn login expired.");
  if (!res.ok) throw new Error(`LinkedIn post failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const urn = res.headers.get("x-restli-id") ?? "";
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : "https://www.linkedin.com/in/me/recent-activity/all/" };
}
