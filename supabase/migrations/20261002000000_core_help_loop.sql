-- HereO core help loop: people, circles, guardians, incidents.
--
-- Design notes
-- * Location is stored as plain lat/lng and distances use haversine. That is
--   plenty for pilot-scale density and avoids a PostGIS dependency; switch to
--   geography(Point) + a GiST index when a city has thousands of guardians.
-- * Anything sensitive (phone, push token, live location) lives in
--   private_profiles, readable only by its owner. Other people only ever see
--   the public profile row.
-- * Triage fields on incidents are written by the dispatch edge function
--   (service role). Clients can create an incident and change its status, but
--   cannot write the AI fields.

create extension if not exists pgcrypto;

create type public.help_mode as enum ('here_o', 'her_o');
create type public.incident_status as enum ('active', 'resolved', 'cancelled');
create type public.responder_status as enum ('notified', 'en_route', 'on_scene', 'declined', 'released');
create type public.urgency as enum ('low', 'elevated', 'high', 'critical');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  -- Set by the verification process (service role), never by the user.
  her_o_verified boolean not null default false,
  -- Set by become_guardian(), which checks the code of conduct was accepted.
  is_guardian boolean not null default false,
  guardian_available boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.private_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  push_token text,
  last_lat double precision check (last_lat between -90 and 90),
  last_lng double precision check (last_lng between -180 and 180),
  last_seen_at timestamptz
);

-- Every new auth user gets both rows.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  insert into public.private_profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- People you trust. Everyone in your circle is alerted when you ask for help.
create table public.circle_members (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

-- Guardian pathway. Users can accept the code of conduct themselves; the rest
-- are recorded by a training partner through the service role.
create table public.guardian_trainings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course text not null check (course in ('code_of_conduct', 'de_escalation', 'bystander', 'stop_the_bleed', 'first_aid')),
  completed_at timestamptz not null default now(),
  primary key (user_id, course)
);

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  mode public.help_mode not null default 'here_o',
  status public.incident_status not null default 'active',
  trigger text not null default 'hold' check (trigger in ('hold', 'tap', 'check_in_missed')),
  note text check (char_length(note) <= 500),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  location_at timestamptz,
  -- Written by the dispatch function.
  urgency public.urgency not null default 'high',
  category text,
  call_911_recommended boolean not null default false,
  brief text,
  brief_at timestamptz,
  triage_source text check (triage_source in ('ai', 'fallback')),
  dispatched_at timestamptz,
  escalated_911_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index incidents_requester_idx on public.incidents (requester_id, created_at desc);
-- One active incident per person: a second hold re-opens the first.
create unique index incidents_one_active_idx on public.incidents (requester_id) where status = 'active';

create table public.incident_responders (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('circle', 'guardian')),
  status public.responder_status not null default 'notified',
  -- Short, specific instruction from triage ("Call her and stay on the line").
  role text,
  distance_m integer,
  updated_at timestamptz not null default now(),
  primary key (incident_id, user_id)
);

create index incident_responders_user_idx on public.incident_responders (user_id, updated_at desc);

create table public.incident_events (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  -- Null for events written by the system or the AI.
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('created', 'triaged', 'brief', 'message', 'status', 'escalated_911', 'resolved', 'cancelled')),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index incident_events_incident_idx on public.incident_events (incident_id, id);

create table public.thanks (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (incident_id, from_id, to_id),
  check (from_id <> to_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_incident_participant(p_incident uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from incidents i where i.id = p_incident and i.requester_id = auth.uid())
      or exists (select 1 from incident_responders r where r.incident_id = p_incident and r.user_id = auth.uid());
$$;

create function public.shares_incident_or_circle(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_other = auth.uid()
      or exists (select 1 from circle_members c
                 where (c.owner_id = auth.uid() and c.member_id = p_other)
                    or (c.member_id = auth.uid() and c.owner_id = p_other))
      or exists (select 1 from incidents i join incident_responders r on r.incident_id = i.id
                 where (i.requester_id = auth.uid() and r.user_id = p_other)
                    or (i.requester_id = p_other and r.user_id = auth.uid()))
      or exists (select 1 from incident_responders a join incident_responders b on a.incident_id = b.incident_id
                 where a.user_id = auth.uid() and b.user_id = p_other);
$$;

create function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Available guardians near a point, closest first. Service role only: it
-- exposes push tokens and is called by the dispatch function.
create function public.nearby_guardians(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 1500,
  p_her_o_only boolean default false,
  p_exclude uuid[] default '{}',
  p_limit integer default 5
) returns table (
  user_id uuid,
  display_name text,
  distance_m integer,
  push_token text,
  trainings text[]
)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, d.dist::integer, pp.push_token,
         coalesce(array(select t.course from guardian_trainings t where t.user_id = p.id order by t.course), '{}')
  from profiles p
  join private_profiles pp on pp.id = p.id
  cross join lateral (select haversine_m(p_lat, p_lng, pp.last_lat, pp.last_lng) as dist) d
  where p.is_guardian and p.guardian_available
    and pp.last_seen_at > now() - interval '15 minutes'
    -- Cheap bounding box before the exact distance.
    and pp.last_lat between p_lat - (p_radius_m / 111000.0) and p_lat + (p_radius_m / 111000.0)
    and abs(pp.last_lng - p_lng) * cos(radians(p_lat)) <= p_radius_m / 111000.0
    and d.dist <= p_radius_m
    and (not p_her_o_only or p.her_o_verified)
    and not (p.id = any (p_exclude))
  order by d.dist
  limit p_limit;
$$;

-- What the home screen shows: a count, never identities or positions.
create function public.guardians_nearby_count(p_lat double precision, p_lng double precision, p_her_o_only boolean default false)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from nearby_guardians(p_lat, p_lng, 1500, p_her_o_only, array[auth.uid()], 1000);
$$;

create function public.add_to_circle(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
begin
  select id into v_member from auth.users where lower(email) = lower(trim(p_email));
  if v_member is null then
    raise exception 'No HereO account uses that email yet' using errcode = 'P0002';
  end if;
  if v_member = auth.uid() then
    raise exception 'You cannot add yourself' using errcode = '22023';
  end if;
  insert into circle_members (owner_id, member_id) values (auth.uid(), v_member)
  on conflict do nothing;
  return v_member;
end $$;

create function public.become_guardian() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from guardian_trainings where user_id = auth.uid() and course = 'code_of_conduct') then
    raise exception 'Accept the guardian code of conduct first' using errcode = '42501';
  end if;
  update profiles set is_guardian = true where id = auth.uid();
end $$;

-- Recognition for the Discover tab: thanks received in the last 30 days.
create function public.top_guardians(p_limit integer default 10)
returns table (user_id uuid, display_name text, thanks_count integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, count(*)::integer
  from thanks t join profiles p on p.id = t.to_id
  where t.created_at > now() - interval '30 days' and p.is_guardian
  group by p.id, p.display_name
  order by count(*) desc, p.display_name
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Triggers that keep the timeline honest
-- ---------------------------------------------------------------------------

create function public.on_incident_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into incident_events (incident_id, actor_id, kind, body)
  values (new.id, new.requester_id, 'created', new.note);
  return new;
end $$;

create trigger incident_created after insert on public.incidents
  for each row execute function public.on_incident_created();

create function public.on_incident_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('resolved', 'cancelled') then
    new.resolved_at := now();
    update incident_responders set status = 'released', updated_at = now()
      where incident_id = new.id and status in ('notified', 'en_route', 'on_scene');
    insert into incident_events (incident_id, actor_id, kind)
      values (new.id, auth.uid(), new.status::text);
  end if;
  if old.status <> 'active' and new.status = 'active' then
    raise exception 'A closed incident cannot be reopened; start a new one' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger incident_status_change before update of status on public.incidents
  for each row execute function public.on_incident_status_change();

create function public.on_responder_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status <> old.status and new.status <> 'released' then
    insert into incident_events (incident_id, actor_id, kind, body)
      values (new.incident_id, new.user_id, 'status', new.status::text);
  end if;
  return new;
end $$;

create trigger responder_status_change before update of status on public.incident_responders
  for each row execute function public.on_responder_status_change();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.circle_members enable row level security;
alter table public.guardian_trainings enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_responders enable row level security;
alter table public.incident_events enable row level security;
alter table public.thanks enable row level security;

-- Column-level grants: RLS decides which rows, these decide which columns.
revoke all on public.profiles, public.private_profiles, public.circle_members, public.guardian_trainings,
  public.incidents, public.incident_responders, public.incident_events, public.thanks from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, guardian_available) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (public.shares_incident_or_circle(id) or is_guardian);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, update (phone, push_token, last_lat, last_lng, last_seen_at) on public.private_profiles to authenticated;
create policy private_profiles_own on public.private_profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, delete on public.circle_members to authenticated;
create policy circle_select on public.circle_members for select to authenticated
  using (owner_id = auth.uid() or member_id = auth.uid());
create policy circle_delete on public.circle_members for delete to authenticated
  using (owner_id = auth.uid() or member_id = auth.uid());

grant select, insert on public.guardian_trainings to authenticated;
create policy trainings_select on public.guardian_trainings for select to authenticated
  using (user_id = auth.uid());
create policy trainings_self_accept on public.guardian_trainings for insert to authenticated
  with check (user_id = auth.uid() and course = 'code_of_conduct');

grant select on public.incidents to authenticated;
grant insert (requester_id, mode, trigger, note, lat, lng, location_at) on public.incidents to authenticated;
grant update (status, note, lat, lng, location_at, escalated_911_at) on public.incidents to authenticated;
create policy incidents_select on public.incidents for select to authenticated
  using (public.is_incident_participant(id));
create policy incidents_insert on public.incidents for insert to authenticated
  with check (requester_id = auth.uid());
create policy incidents_update on public.incidents for update to authenticated
  using (requester_id = auth.uid()) with check (requester_id = auth.uid());

grant select, update (status) on public.incident_responders to authenticated;
create policy responders_select on public.incident_responders for select to authenticated
  using (public.is_incident_participant(incident_id));
create policy responders_update_own on public.incident_responders for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status <> 'released');

grant select, insert (incident_id, actor_id, kind, body) on public.incident_events to authenticated;
create policy events_select on public.incident_events for select to authenticated
  using (public.is_incident_participant(incident_id));
create policy events_insert on public.incident_events for insert to authenticated
  with check (actor_id = auth.uid() and kind in ('message', 'escalated_911')
              and public.is_incident_participant(incident_id));

grant select, insert (incident_id, from_id, to_id, message) on public.thanks to authenticated;
create policy thanks_select on public.thanks for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy thanks_insert on public.thanks for insert to authenticated
  with check (from_id = auth.uid() and public.is_incident_participant(incident_id)
              and exists (select 1 from public.incidents i where i.id = incident_id
                          and (i.requester_id = to_id
                               or exists (select 1 from public.incident_responders r where r.incident_id = i.id and r.user_id = to_id))));

revoke execute on function public.nearby_guardians from public, anon, authenticated;
grant execute on function public.guardians_nearby_count, public.add_to_circle, public.become_guardian,
  public.top_guardians to authenticated;

-- Live updates for the incident screen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.incidents, public.incident_responders, public.incident_events;
  end if;
end $$;
