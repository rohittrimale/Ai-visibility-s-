-- ReviewSathi initial schema
-- Multi-tenant: every business row belongs to an org. Users reach org data
-- only through org_members, enforced by row level security (RLS).
-- Secrets (Google tokens) and billing records are written only by the server
-- with the service role key.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Orgs and membership
-- ---------------------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  business_type text not null default 'other',
  city text,
  alert_email text,
  -- reviews at or below this star rating trigger an urgent alert
  negative_threshold int not null default 3 check (negative_threshold between 1 and 5),
  weekly_digest boolean not null default true,
  plan text not null default 'starter',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  google_account_email text,
  google_connected_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id);

-- Helper used by RLS policies. security definer so it can read org_members
-- without recursing into org_members' own policy.
create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Google connection (tokens are AES-256-GCM encrypted by the app)
-- ---------------------------------------------------------------------------
create table public.google_connections (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  google_account_name text,           -- e.g. accounts/1234567890
  encrypted_refresh_token text not null,
  access_token_cache text,            -- encrypted, short lived
  access_token_expires_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Locations (one Google Business Profile listing each)
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  google_location_name text not null,   -- e.g. locations/987654321
  google_account_name text not null,    -- e.g. accounts/1234567890
  title text not null,
  address text,
  enabled boolean not null default true,
  -- manual: owner approves every reply
  -- auto_positive: 4 and 5 star replies post automatically
  -- auto_all: every reply above the negative threshold posts automatically
  reply_mode text not null default 'manual' check (reply_mode in ('manual', 'auto_positive', 'auto_all')),
  -- auto: match the reviewer's language; en; hi (Hindi); hinglish; mr (Marathi)
  reply_language text not null default 'auto' check (reply_language in ('auto', 'en', 'hi', 'hinglish', 'mr')),
  tone text not null default 'warm' check (tone in ('warm', 'professional', 'friendly')),
  signature text,                        -- e.g. "Team Sharma Sweets"
  extra_instructions text check (char_length(extra_instructions) <= 1000),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, google_location_name)
);
create index locations_org_idx on public.locations(org_id);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  google_review_name text not null,      -- accounts/x/locations/y/reviews/z
  reviewer_name text,
  star_rating int not null check (star_rating between 1 and 5),
  comment text,
  review_created_at timestamptz not null,
  review_updated_at timestamptz,
  -- reply that is live on Google (from Google or posted by us)
  reply_text text,
  reply_updated_at timestamptz,
  draft_reply text,
  status text not null default 'new'
    check (status in ('new', 'drafted', 'posted', 'replied_elsewhere', 'ignored', 'failed')),
  error text,
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, google_review_name)
);
create index reviews_org_status_idx on public.reviews(org_id, status, review_created_at desc);

-- ---------------------------------------------------------------------------
-- Weekly profile posts
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  week_start date not null,
  draft_text text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'skipped', 'failed')),
  google_post_name text,
  error text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, week_start)
);
create index posts_org_idx on public.posts(org_id, week_start desc);

-- ---------------------------------------------------------------------------
-- Billing (Razorpay subscriptions)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  plan text not null,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  status text not null default 'created',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  id text primary key,                   -- Razorpay event id (x-razorpay-event-id) for idempotency
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
create trigger google_connections_touch before update on public.google_connections
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.google_connections enable row level security;
alter table public.locations enable row level security;
alter table public.reviews enable row level security;
alter table public.posts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

-- orgs: members read, owners update settings. Inserts happen server side.
create policy orgs_select on public.orgs for select using (public.is_org_member(id));
create policy orgs_update on public.orgs for update using (public.is_org_owner(id)) with check (public.is_org_owner(id));

-- org_members: members can see who else is in their org.
create policy members_select on public.org_members for select using (public.is_org_member(org_id));

-- google_connections: no policies, so only the service role can touch tokens.

-- locations: members read, owners change settings.
create policy locations_select on public.locations for select using (public.is_org_member(org_id));
create policy locations_update on public.locations for update using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id));

-- reviews and posts: members read and edit drafts.
create policy reviews_select on public.reviews for select using (public.is_org_member(org_id));
create policy reviews_update on public.reviews for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy posts_select on public.posts for select using (public.is_org_member(org_id));
create policy posts_update on public.posts for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- subscriptions: members read their plan status.
create policy subscriptions_select on public.subscriptions for select using (public.is_org_member(org_id));

-- billing_events: service role only.

-- Stop users from changing protected columns through the orgs_update policy.
create or replace function public.protect_org_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.plan = old.plan;
    new.trial_ends_at = old.trial_ends_at;
    new.google_account_email = old.google_account_email;
    new.google_connected_at = old.google_connected_at;
  end if;
  return new;
end;
$$;
create trigger orgs_protect before update on public.orgs
  for each row execute function public.protect_org_columns();

create or replace function public.protect_location_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.org_id = old.org_id;
    new.google_location_name = old.google_location_name;
    new.google_account_name = old.google_account_name;
  end if;
  return new;
end;
$$;
create trigger locations_protect before update on public.locations
  for each row execute function public.protect_location_columns();

create or replace function public.protect_review_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.org_id = old.org_id;
    new.location_id = old.location_id;
    new.google_review_name = old.google_review_name;
    new.star_rating = old.star_rating;
    new.comment = old.comment;
    new.reviewer_name = old.reviewer_name;
    new.reply_text = old.reply_text;
    -- users may only move a review between drafted and ignored; posting goes
    -- through the server, which uses the service role.
    if new.status not in ('drafted', 'ignored', 'new') then
      new.status = old.status;
    end if;
  end if;
  return new;
end;
$$;
create trigger reviews_protect before update on public.reviews
  for each row execute function public.protect_review_columns();

create or replace function public.protect_post_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.org_id = old.org_id;
    new.location_id = old.location_id;
    new.google_post_name = old.google_post_name;
    if new.status not in ('draft', 'skipped') then
      new.status = old.status;
    end if;
  end if;
  return new;
end;
$$;
create trigger posts_protect before update on public.posts
  for each row execute function public.protect_post_columns();
