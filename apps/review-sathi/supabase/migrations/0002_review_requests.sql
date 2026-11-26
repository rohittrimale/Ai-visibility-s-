-- Review requests: each location gets a Google review link, a short
-- trackable link (/r/<code>) for QR codes and WhatsApp, and a click counter.

alter table public.locations
  add column place_id text,
  -- link from Google (metadata.newReviewUri); filled on import
  add column google_review_url text,
  -- owner's own link, used instead of Google's when set
  add column custom_review_url text check (custom_review_url is null or custom_review_url ~ '^https://'),
  add column short_code text unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  add column review_link_clicks integer not null default 0;

update public.locations set short_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) where short_code is null;
alter table public.locations alter column short_code set not null;

-- Counts a click and returns where to send the customer. Callable without
-- signing in (customers scan the QR code), so it reveals nothing else.
create or replace function public.track_review_link(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
begin
  update public.locations
     set review_link_clicks = review_link_clicks + 1
   where short_code = code
  returning coalesce(custom_review_url, google_review_url) into target;
  return target;
end;
$$;

revoke all on function public.track_review_link(text) from public;
grant execute on function public.track_review_link(text) to anon, authenticated, service_role;

-- Users may set custom_review_url; everything else here is server-managed.
create or replace function public.protect_location_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.org_id = old.org_id;
    new.google_location_name = old.google_location_name;
    new.google_account_name = old.google_account_name;
    new.place_id = old.place_id;
    new.google_review_url = old.google_review_url;
    new.short_code = old.short_code;
    new.review_link_clicks = old.review_link_clicks;
  end if;
  return new;
end;
$$;
