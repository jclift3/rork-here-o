-- HereO ring: a loud mode on the help request.
--
-- * One trigger sounds a siren on her phone (or stays silent), alerts her
--   circle and guardians as today, and rings opted-in HereO users nearby.
-- * Neighbours who are rung live in ring_responders, not incident_responders,
--   so they never become incident participants: they see a pin, a distance
--   and how many others are going, never her name, photo or timeline.
-- * Ending a request can need a PIN. A second, duress PIN looks like a cancel
--   on her phone but keeps the request open and tells her circle.
-- * Neighbours can report a false alarm. Two false alarms in 30 days limit an
--   account's ring to its circle and guardians.

-- ---------------------------------------------------------------------------
-- Settings and state
-- ---------------------------------------------------------------------------

alter table public.private_profiles
  add column ring_opt_in boolean not null default false,
  add column ring_travel text not null default 'foot' check (ring_travel in ('foot', 'drive')),
  add column alarm_style text not null default 'loud' check (alarm_style in ('loud', 'silent'));

grant update (ring_opt_in, ring_travel, alarm_style) on public.private_profiles to authenticated;

alter table public.incidents
  -- How her phone sounded: null means the request did not ring anyone nearby.
  add column alarm text check (alarm in ('loud', 'silent')),
  -- Written by the ring function when neighbours were rung.
  add column ring_at timestamptz,
  -- Set when she ended the request with her duress PIN.
  add column duress_at timestamptz,
  -- When the ring function told her people about the duress PIN, and told
  -- neighbours it was over. Each is sent once.
  add column duress_alerted_at timestamptz,
  add column all_clear_at timestamptz;

grant insert (alarm) on public.incidents to authenticated;
grant update (alarm) on public.incidents to authenticated;

-- PIN hashes and ring bans. Service only: no grants, reached through RPCs.
create table public.ring_secrets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text,
  duress_hash text,
  -- Set by hand for deliberate pranks: the account can no longer ring anyone.
  banned_at timestamptz
);

alter table public.ring_secrets enable row level security;
revoke all on public.ring_secrets from anon, authenticated;

-- Neighbours rung for a request.
create table public.ring_responders (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  travel text not null default 'foot' check (travel in ('foot', 'drive')),
  distance_m integer,
  status public.responder_status not null default 'notified',
  false_alarm_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (incident_id, user_id)
);

create index ring_responders_user_idx on public.ring_responders (user_id, created_at desc);

alter table public.ring_responders enable row level security;
revoke all on public.ring_responders from anon, authenticated;
-- Writes go through respond_to_ring and report_false_ring.
grant select on public.ring_responders to authenticated;
create policy ring_responders_select on public.ring_responders for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.incidents i
                    where i.id = incident_id and i.requester_id = (select auth.uid())));

-- Neighbours are released when the request ends, like circle and guardians.
create function public.release_ring_responders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('resolved', 'cancelled') then
    update ring_responders set status = 'released', updated_at = now()
      where incident_id = new.id and status in ('notified', 'en_route', 'on_scene');
  end if;
  return null;
end $$;

create trigger incident_release_ring after update of status on public.incidents
  for each row execute function public.release_ring_responders();

revoke execute on function public.release_ring_responders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Matching (service only)
-- ---------------------------------------------------------------------------

-- Ring radii, in metres: everyone this close is always rung, then the nearest
-- up to ring_max_people() in total, walkers within half a mile and drivers
-- within a mile.
create function public.ring_always_m() returns double precision
language sql immutable set search_path = '' as $$ select 100::double precision $$;
create function public.ring_foot_m() returns double precision
language sql immutable set search_path = '' as $$ select 805::double precision $$;
create function public.ring_drive_m() returns double precision
language sql immutable set search_path = '' as $$ select 1609::double precision $$;
create function public.ring_max_people() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;

create function public.nearby_ring_responders(
  p_lat double precision,
  p_lng double precision,
  p_her_o_only boolean default false,
  p_exclude uuid[] default '{}'
) returns table (user_id uuid, distance_m integer, travel text, push_token text)
language sql stable security definer set search_path = public as $$
  with c as (
    select p.id, d.dist, pp.ring_travel, pp.push_token,
           row_number() over (order by d.dist) as rn
    from profiles p
    join private_profiles pp on pp.id = p.id
    cross join lateral (select haversine_m(p_lat, p_lng, pp.last_lat, pp.last_lng) as dist) d
    where pp.ring_opt_in
      and pp.last_seen_at > now() - interval '20 minutes'
      and pp.last_lat between p_lat - (ring_drive_m() / 111000.0) and p_lat + (ring_drive_m() / 111000.0)
      and abs(pp.last_lng - p_lng) * cos(radians(p_lat)) <= ring_drive_m() / 111000.0
      and d.dist <= case pp.ring_travel when 'drive' then ring_drive_m() else ring_foot_m() end
      and (not p_her_o_only or p.her_o_verified)
      and not (p.id = any (p_exclude))
      and not exists (select 1 from ring_secrets s where s.user_id = p.id and s.banned_at is not null)
  )
  select id, dist::integer, ring_travel, push_token from c
  where dist <= ring_always_m() or rn <= ring_max_people()
  order by dist;
$$;

-- Requests in the last 30 days that neighbours reported as false alarms: at
-- least two reports, or every neighbour rung when fewer than two were.
create function public.ring_strikes(p_user uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from (
    select i.id
    from incidents i join ring_responders r on r.incident_id = i.id
    where i.requester_id = p_user and i.created_at > now() - interval '30 days'
    group by i.id
    having count(r.false_alarm_at) >= least(2, count(*))
  ) s;
$$;

revoke execute on function public.nearby_ring_responders(double precision, double precision, boolean, uuid[]),
  public.ring_strikes(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs for the app
-- ---------------------------------------------------------------------------

-- Set, change or clear (null) the cancel or duress PIN. Changing either needs
-- the current cancel PIN once one is set.
create function public.set_ring_pin(p_kind text, p_pin text, p_current text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  s ring_secrets;
begin
  if p_kind not in ('cancel', 'duress') then
    raise exception 'Unknown PIN kind' using errcode = '22023';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'A PIN is 4 to 8 digits' using errcode = '22023';
  end if;
  insert into ring_secrets (user_id) values (auth.uid()) on conflict do nothing;
  select * into s from ring_secrets where user_id = auth.uid() for update;
  if s.pin_hash is not null and (p_current is null or crypt(p_current, s.pin_hash) <> s.pin_hash) then
    raise exception 'Enter your current PIN' using errcode = '28P01';
  end if;
  if p_kind = 'cancel' then
    if p_pin is not null and s.duress_hash is not null and crypt(p_pin, s.duress_hash) = s.duress_hash then
      raise exception 'Your PIN and duress PIN must be different' using errcode = '22023';
    end if;
    -- Clearing the PIN clears the duress PIN too: it only means something next to a PIN.
    update ring_secrets
      set pin_hash = case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end,
          duress_hash = case when p_pin is null then null else duress_hash end
      where user_id = auth.uid();
  else
    if s.pin_hash is null and p_pin is not null then
      raise exception 'Set your PIN first' using errcode = '22023';
    end if;
    if p_pin is not null and crypt(p_pin, s.pin_hash) = s.pin_hash then
      raise exception 'Your PIN and duress PIN must be different' using errcode = '22023';
    end if;
    update ring_secrets
      set duress_hash = case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end
      where user_id = auth.uid();
  end if;
end $$;

create function public.ring_pin_status()
returns table (has_pin boolean, has_duress boolean, strikes integer, limited boolean, banned boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(s.pin_hash is not null, false),
         coalesce(s.duress_hash is not null, false),
         k.n,
         k.n >= 2 or s.banned_at is not null,
         s.banned_at is not null
  from (select ring_strikes(auth.uid()) as n) k
  left join ring_secrets s on s.user_id = auth.uid();
$$;

-- End her request. With a PIN set, the PIN closes it ('closed'), the duress
-- PIN keeps it open and marks it ('duress'), anything else is refused.
create function public.end_help_request(p_incident uuid, p_status text default 'resolved', p_pin text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  s ring_secrets;
begin
  if p_status not in ('resolved', 'cancelled') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if not exists (select 1 from incidents where id = p_incident and requester_id = auth.uid() and status = 'active') then
    raise exception 'No open request' using errcode = 'P0002';
  end if;
  select * into s from ring_secrets where user_id = auth.uid();
  if s.pin_hash is not null then
    if s.duress_hash is not null and p_pin is not null and crypt(p_pin, s.duress_hash) = s.duress_hash then
      update incidents set duress_at = coalesce(duress_at, now()) where id = p_incident;
      return 'duress';
    end if;
    if p_pin is null or crypt(p_pin, s.pin_hash) <> s.pin_hash then
      raise exception 'Wrong PIN' using errcode = '28P01';
    end if;
  end if;
  update incidents set status = p_status::incident_status where id = p_incident;
  return 'closed';
end $$;

-- What a rung neighbour sees. The point is shown only while the request is open.
create function public.ring_card(p_incident uuid)
returns table (
  incident_id uuid,
  active boolean,
  lat double precision,
  lng double precision,
  location_at timestamptz,
  created_at timestamptz,
  her_o boolean,
  travel text,
  distance_m integer,
  my_status public.responder_status,
  false_alarm_reported boolean,
  going integer,
  rung integer
)
language sql stable security definer set search_path = public as $$
  select i.id,
         i.status = 'active',
         case when i.status = 'active' then i.lat end,
         case when i.status = 'active' then i.lng end,
         case when i.status = 'active' then i.location_at end,
         i.created_at,
         i.mode = 'her_o',
         me.travel,
         me.distance_m,
         me.status,
         me.false_alarm_at is not null,
         (select count(*)::integer from ring_responders r
           where r.incident_id = i.id and r.user_id <> me.user_id and r.status in ('en_route', 'on_scene'))
         + (select count(*)::integer from incident_responders r
           where r.incident_id = i.id and r.status in ('en_route', 'on_scene')),
         (select count(*)::integer from ring_responders r where r.incident_id = i.id)
  from ring_responders me join incidents i on i.id = me.incident_id
  where me.incident_id = p_incident and me.user_id = auth.uid();
$$;

create function public.respond_to_ring(p_incident uuid, p_status public.responder_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('en_route', 'on_scene', 'declined') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update ring_responders r set status = p_status, updated_at = now()
    from incidents i
    where r.incident_id = p_incident and r.user_id = auth.uid() and i.id = r.incident_id
      and i.status = 'active' and r.status <> 'released';
  if not found then
    raise exception 'This alert has ended' using errcode = 'P0002';
  end if;
end $$;

-- One tap, up to a day after the ring.
create function public.report_false_ring(p_incident uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ring_responders set false_alarm_at = coalesce(false_alarm_at, now()), updated_at = now()
    where incident_id = p_incident and user_id = auth.uid() and created_at > now() - interval '1 day';
  if not found then
    raise exception 'This alert can no longer be reported' using errcode = 'P0002';
  end if;
end $$;

-- Open rings for the home screen.
create function public.my_active_rings()
returns table (incident_id uuid, distance_m integer, travel text, my_status public.responder_status, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.incident_id, r.distance_m, r.travel, r.status, r.created_at
  from ring_responders r join incidents i on i.id = r.incident_id
  where r.user_id = auth.uid() and i.status = 'active' and r.status in ('notified', 'en_route', 'on_scene')
  order by r.created_at desc;
$$;

revoke execute on function
  public.set_ring_pin(text, text, text),
  public.ring_pin_status(),
  public.end_help_request(uuid, text, text),
  public.ring_card(uuid),
  public.respond_to_ring(uuid, public.responder_status),
  public.report_false_ring(uuid),
  public.my_active_rings()
from public, anon;

grant execute on function
  public.set_ring_pin(text, text, text),
  public.ring_pin_status(),
  public.end_help_request(uuid, text, text),
  public.ring_card(uuid),
  public.respond_to_ring(uuid, public.responder_status),
  public.report_false_ring(uuid),
  public.my_active_rings()
to authenticated;

-- Live updates for her "neighbours on the way" count and the neighbour card.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ring_responders;
  end if;
end $$;
