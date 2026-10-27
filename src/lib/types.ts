// Row shapes for the database tables (see supabase/migrations/0001_init.sql).

export type RegistrationMode = "free_byok" | "paid" | "both";

export type AppSettings = {
  registration_mode: RegistrationMode;
  price_inr: number;
  price_usd: number;
  billing_period_days: number;
  razorpay_enabled: boolean;
  lemonsqueezy_enabled: boolean;
  free_daily_drafts: number;
  pro_daily_drafts: number;
  free_max_accounts: number;
  pro_max_accounts: number;
  announcement: string | null;
  require_email_confirm: boolean;
  free_platform_ai: boolean;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  plan: "free" | "pro";
  status: "active" | "pending_payment" | "suspended";
  paid_until: string | null;
  gemini_key_enc: string | null;
  platform_ai: boolean;
  telegram_chat_id: number | null;
  whatsapp_number: string | null;
  link_code: string | null;
  pending_action: PendingAction | null;
  default_workspace_id: string | null;
  created_at: string;
  last_active_at: string;
};

export type PendingAction = { type: "edit"; draftId: string } | { type: "idea" };

export type ImageTheme = "navy" | "light" | "sunset";

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  about: string;
  audience: string;
  voice: string;
  topics: string[];
  timezone: string;
  auto_draft: boolean;
  draft_hour: number;
  image_theme: ImageTheme;
  created_at: string;
};

export type MemberRole = "owner" | "editor" | "viewer";

export type LinkedInAccount = {
  id: string;
  workspace_id: string;
  connected_by: string | null;
  name: string;
  person_urn: string;
  access_token_enc: string;
  expires_at: string;
  created_at: string;
};

export type ImageKind = "card" | "flowchart" | "quote" | "photo" | "none";

export type Visual = {
  suggested: "card" | "flowchart" | "quote" | "none";
  title: string;
  points: string[];
  steps: string[];
  quote: string;
};

export type Slide = { title: string; body: string };

export type DraftStatus = "pending" | "scheduled" | "publishing" | "posted" | "skipped" | "failed";

export type Draft = {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  created_by: string | null;
  origin: "news" | "idea" | "manual";
  category: string | null;
  idea: string | null;
  topic: string;
  source_title: string | null;
  source_url: string | null;
  text: string;
  format: "post" | "carousel";
  visual: Visual | null;
  slides: Slide[] | null;
  image_kind: ImageKind;
  photo_path: string | null;
  telegram_photo_id: string | null;
  status: DraftStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  post_urn: string | null;
  post_url: string | null;
  error: string | null;
  chat_refs: ChatRefs;
  created_at: string;
  updated_at: string;
};

export type ChatRefs = { telegram?: { textId?: number; imageId?: number }; whatsapp?: { messageId?: string } };

export type PostMetric = {
  id: string;
  draft_id: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  source: "manual" | "api";
  recorded_at: string;
};

export type AdminInvite = {
  id: string;
  email: string;
  token: string;
  plan: "free" | "pro";
  pro_days: number | null;
  platform_ai: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};
