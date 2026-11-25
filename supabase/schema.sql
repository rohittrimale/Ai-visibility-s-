-- AI Visibility Checker: Supabase schema.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
-- All free-check writes use the SERVICE ROLE key from the server; browsers only ever use the anon key + RLS.

-- ───────────────────────── users (profile + plan; mirrors auth.users) ─────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free','starter','growth')),
  razorpay_customer_id text,
  razorpay_subscription_id text,
  plan_renews_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── businesses ─────────────────────────
-- user_id is NULL for anonymous free checks.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  website text not null check (char_length(website) <= 200),
  city text not null check (char_length(city) between 2 and 60),
  category text not null check (char_length(category) between 2 and 50),
  competitors text[] not null default '{}' check (cardinality(competitors) <= 3),
  tracked boolean not null default false,          -- weekly re-run on paid plans
  created_at timestamptz not null default now()
);
create index if not exists businesses_user_idx on public.businesses (user_id);
create index if not exists businesses_tracked_idx on public.businesses (tracked) where tracked;

-- Saved prompts for paid businesses (falls back to generated prompts if empty)
create table if not exists public.business_prompts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  prompt text not null check (char_length(prompt) <= 200),
  created_at timestamptz not null default now(),
  unique (business_id, prompt)
);

-- ───────────────────────── checks ─────────────────────────
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),   -- unguessable; doubles as the share link token
  business_id uuid not null references public.businesses (id) on delete cascade,
  status text not null default 'running' check (status in ('running','done','failed')),
  source text not null default 'free' check (source in ('free','manual','weekly')),
  score int check (score between 0 and 100),
  engine_scores jsonb,
  report jsonb,                                     -- tips, top competitors, counts
  unlocked boolean not null default false,          -- true after the email gate
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists checks_business_idx on public.checks (business_id, created_at desc);
-- 'audit' = one-time paid Deep Audit (added later; re-create the constraint so re-running this file upgrades old databases)
alter table public.checks drop constraint if exists checks_source_check;
alter table public.checks add constraint checks_source_check check (source in ('free','manual','weekly','audit'));

-- ───────────────────────── prompt_results ─────────────────────────
create table if not exists public.prompt_results (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  engine text not null check (engine in ('openai','gemini','perplexity')),
  prompt text not null,
  prompt_hash text not null,
  raw_answer text,
  parsed jsonb,                                     -- {brand_mentioned, position, sentiment, competitors_mentioned, sources}
  sources text[] not null default '{}',
  cached boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists prompt_results_check_idx on public.prompt_results (check_id);
-- 24h answer cache lookup
create index if not exists prompt_results_cache_idx on public.prompt_results (engine, prompt_hash, created_at desc) where error is null;

-- ───────────────────────── leads ─────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  check_id uuid not null references public.checks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (email, check_id)
);
create index if not exists leads_email_idx on public.leads (email);

-- ───────────────────────── audits (one-time paid Deep Audit) ─────────────────────────
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,        -- free check it was bought from
  email text not null check (char_length(email) <= 254),
  amount_inr int not null check (amount_inr > 0),
  status text not null default 'pending' check (status in ('pending','paid','running','done','failed')),
  payment_link_id text unique,                                                  -- Razorpay plink_...
  audit_check_id uuid references public.checks (id) on delete set null,          -- the deep check
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists audits_status_idx on public.audits (status, updated_at);

-- ───────────────────────── usage_log (per provider call, for cost auditing) ─────────────────────────
create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  check_id uuid references public.checks (id) on delete set null,
  engine text not null,
  kind text not null check (kind in ('answer','parse')),
  cost_usd numeric(10,5) not null default 0,
  cached boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists usage_log_created_idx on public.usage_log (created_at);

-- ───────────────────────── abuse controls ─────────────────────────
create table if not exists public.rate_limits (
  key text not null,                                -- 'ip:<hash>' | 'email:<hash>'
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (key, day)
);

create table if not exists public.spend_counters (
  month text primary key,                           -- 'YYYY-MM' (UTC)
  spent_usd numeric(12,5) not null default 0
);

-- Atomic: increments and reports whether the caller is still within the limit.
create or replace function public.hit_rate_limit(p_key text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into rate_limits (key, day, count) values (p_key, (now() at time zone 'utc')::date, 1)
  on conflict (key, day) do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end $$;

-- Atomic: reserve spend only if it keeps the month under the cap.
create or replace function public.reserve_spend(p_month text, p_amount numeric, p_cap numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_spent numeric;
begin
  insert into spend_counters (month, spent_usd) values (p_month, 0) on conflict (month) do nothing;
  update spend_counters set spent_usd = spent_usd + p_amount
   where month = p_month and spent_usd + p_amount <= p_cap
  returning spent_usd into v_spent;
  return v_spent is not null;
end $$;

-- Adjust the counter (positive or negative) when the real cost is known. Never below zero.
create or replace function public.add_spend(p_month text, p_delta numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into spend_counters (month, spent_usd) values (p_month, greatest(p_delta, 0))
  on conflict (month) do update set spent_usd = greatest(spend_counters.spent_usd + p_delta, 0);
end $$;

-- These must only be callable from the server (service role), never with the public anon key.
revoke all on function public.hit_rate_limit(text, int) from public, anon, authenticated;
revoke all on function public.reserve_spend(text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.add_spend(text, numeric) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int) to service_role;
grant execute on function public.reserve_spend(text, numeric, numeric) to service_role;
grant execute on function public.add_spend(text, numeric) to service_role;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.users            enable row level security;
alter table public.businesses       enable row level security;
alter table public.business_prompts enable row level security;
alter table public.checks           enable row level security;
alter table public.prompt_results   enable row level security;
alter table public.leads            enable row level security;   -- no policies: service role only
alter table public.usage_log        enable row level security;   -- no policies: service role only
alter table public.rate_limits      enable row level security;   -- no policies: service role only
alter table public.spend_counters   enable row level security;   -- no policies: service role only
alter table public.audits           enable row level security;   -- no policies: service role only

-- Logged-in users can read their own profile (plan changes only via server/webhook).
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select to authenticated using (id = auth.uid());

drop policy if exists businesses_own on public.businesses;
create policy businesses_own on public.businesses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists business_prompts_own on public.business_prompts;
create policy business_prompts_own on public.business_prompts for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

drop policy if exists checks_select_own on public.checks;
create policy checks_select_own on public.checks for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid()));

drop policy if exists prompt_results_select_own on public.prompt_results;
create policy prompt_results_select_own on public.prompt_results for select to authenticated
  using (exists (select 1 from public.checks c join public.businesses b on b.id = c.business_id
                 where c.id = check_id and b.user_id = auth.uid()));
