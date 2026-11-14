-- hereo.app waitlist + Founding 100 hero applications.
-- The site calls public.site_signup() with the anon key; the table itself is not
-- readable or writable by anon/authenticated. public.founding_hero_count() feeds the
-- public "N of 100" counter (a number only, no personal data).

create table if not exists public.site_signups (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  kind          text not null check (kind in ('waitlist','hero')),
  email         text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name          text check (length(name) <= 120),
  city          text not null check (city in ('cambridge','sarasota','other')),
  city_other    text check (length(city_other) <= 120),
  affiliation   text check (length(affiliation) <= 160),   -- college, society, workplace
  nights        text[] not null default '{}',              -- thu/fri/sat availability
  first_aid     boolean not null default false,
  why           text check (length(why) <= 1000),
  over_18       boolean not null default false,
  consent       boolean not null check (consent),          -- agreed to be contacted
  founding_no   int,                                       -- Cambridge hero applicant number
  source        text check (length(source) <= 200),        -- utm_source / ref
  referrer      text check (length(referrer) <= 500),
  ip_hash       text,
  unique (kind, email)
);

alter table public.site_signups enable row level security;
revoke all on public.site_signups from anon, authenticated;

create or replace function public.site_signup(
  p_kind text, p_email text, p_city text,
  p_name text default null, p_city_other text default null, p_affiliation text default null,
  p_nights text[] default '{}', p_first_aid boolean default false, p_why text default null,
  p_over_18 boolean default false, p_consent boolean default false,
  p_source text default null, p_referrer text default null, p_hp text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(btrim(p_email));
  v_ip text;
  v_hash text;
  v_row public.site_signups;
  v_no int;
begin
  -- honeypot: bots fill the hidden field; pretend it worked
  if coalesce(p_hp,'') <> '' then return jsonb_build_object('ok', true); end if;
  if not coalesce(p_consent,false) then raise exception 'consent required' using errcode = '22023'; end if;
  if p_kind = 'hero' and not coalesce(p_over_18,false) then raise exception 'heroes must be 18 or over' using errcode = '22023'; end if;

  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for',''), ',', 1);
  exception when others then v_ip := ''; end;
  if v_ip <> '' then
    v_hash := encode(extensions.digest('hereo-site:' || v_ip, 'sha256'), 'hex');
    if (select count(*) from public.site_signups where ip_hash = v_hash and updated_at > now() - interval '1 hour') >= 20 then
      raise exception 'too many sign-ups, try again later' using errcode = '22023';
    end if;
  end if;

  insert into public.site_signups as s
    (kind, email, name, city, city_other, affiliation, nights, first_aid, why, over_18, consent, source, referrer, ip_hash)
  values
    (p_kind, v_email, nullif(btrim(p_name),''), p_city, nullif(btrim(p_city_other),''), nullif(btrim(p_affiliation),''),
     coalesce(p_nights,'{}'), coalesce(p_first_aid,false), nullif(btrim(p_why),''), coalesce(p_over_18,false), true,
     left(p_source,200), left(p_referrer,500), v_hash)
  on conflict (kind, email) do update set
    name = coalesce(excluded.name, s.name), city = excluded.city, city_other = coalesce(excluded.city_other, s.city_other),
    affiliation = coalesce(excluded.affiliation, s.affiliation), nights = excluded.nights, first_aid = excluded.first_aid,
    why = coalesce(excluded.why, s.why), over_18 = excluded.over_18, updated_at = now()
  returning * into v_row;

  -- numbered Founding 100 applicant (Cambridge heroes only), assigned once
  if v_row.kind = 'hero' and v_row.city = 'cambridge' and v_row.founding_no is null then
    perform pg_advisory_xact_lock(hashtext('site_signups_founding_no'));
    select coalesce(max(founding_no),0) + 1 into v_no from public.site_signups;
    update public.site_signups set founding_no = v_no where id = v_row.id returning * into v_row;
  end if;

  return jsonb_build_object('ok', true, 'kind', v_row.kind, 'founding_no', v_row.founding_no);
end $$;

create or replace function public.founding_hero_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.site_signups where kind = 'hero' and city = 'cambridge';
$$;

revoke all on function public.site_signup(text,text,text,text,text,text,text[],boolean,text,boolean,boolean,text,text,text) from public;
grant execute on function public.site_signup(text,text,text,text,text,text,text[],boolean,text,boolean,boolean,text,text,text) to anon, authenticated;
revoke all on function public.founding_hero_count() from public;
grant execute on function public.founding_hero_count() to anon, authenticated;
