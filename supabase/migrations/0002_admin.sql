-- Admin panel upgrade. Run once in Supabase: SQL Editor -> paste -> Run.
-- Safe to run more than once; only adds things.

-- ---------------------------------------------------------------- settings
-- Off by default: new accounts are confirmed instantly, so sign-ups never hit
-- Supabase's hourly email limit. Turn on only with your own SMTP set up.
alter table app_settings add column if not exists require_email_confirm boolean not null default false;
-- Let every free user write posts with the platform Gemini key (no own key needed).
alter table app_settings add column if not exists free_platform_ai boolean not null default false;

-- ---------------------------------------------------------------- people
-- Admin switch: this user writes posts with the platform Gemini key, whatever their plan.
alter table profiles add column if not exists platform_ai boolean not null default false;

-- ---------------------------------------------------------------- admin invites
-- An admin invites someone by email with access already decided. Applied
-- when that email signs up (or immediately, if the account already exists).
create table if not exists admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  pro_days int,                         -- null with plan 'pro' = lifetime
  platform_ai boolean not null default true,
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references profiles (id) on delete set null
);
create index if not exists admin_invites_email on admin_invites (lower(email)) where accepted_at is null;

alter table admin_invites enable row level security;
