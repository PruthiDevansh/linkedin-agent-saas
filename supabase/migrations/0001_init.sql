-- Kalam schema. Run once in Supabase: SQL Editor -> paste -> Run.
--
-- Security model: RLS is ON for every table with NO policies, so the public
-- (anon) key can read nothing. All data access goes through the server with
-- the service-role key, after the server has checked who the user is.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- settings
-- One row, edited from the admin panel.
create table app_settings (
  id int primary key default 1 check (id = 1),
  registration_mode text not null default 'free_byok'
    check (registration_mode in ('free_byok', 'paid', 'both')),
  price_inr int not null default 499,          -- rupees per period
  price_usd numeric(10,2) not null default 9,  -- dollars per period
  billing_period_days int not null default 30, -- 30 = monthly, 365 = yearly, 0 = lifetime
  razorpay_enabled boolean not null default false,
  lemonsqueezy_enabled boolean not null default false,
  free_daily_drafts int not null default 5,
  pro_daily_drafts int not null default 30,
  free_max_accounts int not null default 1,
  pro_max_accounts int not null default 5,
  announcement text,
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1);

-- ---------------------------------------------------------------- people
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'pending_payment', 'suspended')),
  paid_until timestamptz,
  gemini_key_enc text,                 -- user's own Gemini key, AES-GCM encrypted
  telegram_chat_id bigint unique,
  whatsapp_number text unique,
  link_code text unique,               -- one-time code to link Telegram/WhatsApp
  pending_action jsonb,                -- e.g. {"type":"edit","draftId":"..."} from chat
  default_workspace_id uuid,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  -- brand voice and preferences used by the AI
  about text not null default '',
  audience text not null default '',
  voice text not null default 'Simple, clear English. Practical, honest, a little opinionated. Short lines.',
  topics text[] not null default array['ai-models', 'career'],
  timezone text not null default 'Asia/Kolkata',
  auto_draft boolean not null default true,
  draft_hour int not null default 8 check (draft_hour between 0 and 23),
  image_theme text not null default 'navy' check (image_theme in ('navy', 'light', 'sunset')),
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id) references workspaces (id) on delete set null;

create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  token text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- ---------------------------------------------------------------- linkedin
create table linkedin_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  connected_by uuid references profiles (id) on delete set null,
  name text not null default '',
  person_urn text not null,
  access_token_enc text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, person_urn)
);

-- ---------------------------------------------------------------- content
create table drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  origin text not null default 'news' check (origin in ('news', 'idea', 'manual')),
  category text,
  idea text,
  topic text not null default '',
  source_title text,
  source_url text,
  text text not null,
  format text not null default 'post' check (format in ('post', 'carousel')),
  visual jsonb,                          -- {title, points[], steps[], suggested}
  slides jsonb,                          -- carousel slides [{title, body}]
  image_kind text not null default 'none' check (image_kind in ('card', 'flowchart', 'quote', 'photo', 'none')),
  photo_path text,                       -- Supabase Storage path for an uploaded photo
  telegram_photo_id text,                -- photo sent on Telegram
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'publishing', 'posted', 'skipped', 'failed')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  post_urn text,
  post_url text,
  error text,
  chat_refs jsonb not null default '{}',  -- message ids per channel, to update buttons
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_workspace_created on drafts (workspace_id, created_at desc);
create index drafts_due on drafts (scheduled_at) where status = 'scheduled';

create table post_metrics (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts (id) on delete cascade,
  impressions int not null default 0,
  reactions int not null default 0,
  comments int not null default 0,
  reposts int not null default 0,
  source text not null default 'manual' check (source in ('manual', 'api')),
  recorded_at timestamptz not null default now()
);
create index post_metrics_draft on post_metrics (draft_id, recorded_at desc);

create table used_links (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, url)
);

-- Hooks, templates, trending stories and admin-curated examples.
create table inspiration_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hook', 'template', 'trending', 'curated')),
  category text not null default 'general',
  title text not null,
  body text not null default '',
  source_url text,
  score int not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inspiration_kind on inspiration_items (kind, created_at desc);
create unique index inspiration_trending_url on inspiration_items (source_url) where kind = 'trending';

-- ---------------------------------------------------------------- money & usage
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  provider text not null check (provider in ('razorpay', 'lemonsqueezy', 'manual')),
  provider_ref text not null,
  amount numeric(12,2) not null,
  currency text not null,
  status text not null check (status in ('created', 'paid', 'failed', 'refunded')),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table usage_events (
  id bigserial primary key,
  user_id uuid references profiles (id) on delete set null,
  workspace_id uuid references workspaces (id) on delete set null,
  type text not null,  -- draft_generated, post_published, carousel, image, login, ...
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index usage_user_created on usage_events (user_id, created_at desc);
create index usage_type_created on usage_events (type, created_at desc);

-- ---------------------------------------------------------------- RLS: deny all public access
alter table app_settings enable row level security;
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table linkedin_accounts enable row level security;
alter table drafts enable row level security;
alter table post_metrics enable row level security;
alter table used_links enable row level security;
alter table inspiration_items enable row level security;
alter table payments enable row level security;
alter table usage_events enable row level security;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;
