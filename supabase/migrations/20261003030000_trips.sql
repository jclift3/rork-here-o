-- Trips: a walk, run or ride the circle follows live from the start.
--
-- * A trip is a row in walks with a kind and an optional destination point.
--   When the traveller's shared location comes within 75 m of it, the trip
--   ends itself as arrived and the circle hears "home safe".
-- * Starting and arriving notify the circle through the check-ins function,
--   called from a trigger so it happens whichever device or widget did it.
-- * A missed check-in alerts only the circle. People who opt in with
--   alert_guardians_on_missed also get nearby guardians, a few minutes later,
--   if the request is still open; guardians are told it is an unanswered
--   check-in, not a confirmed emergency.

create type public.trip_kind as enum ('walk', 'run', 'ride');

alter table public.walks
  add column kind public.trip_kind not null default 'walk',
  add column dest_lat double precision check (dest_lat between -90 and 90),
  add column dest_lng double precision check (dest_lng between -180 and 180),
  -- True when the trip ended because the traveller reached the destination.
  add column arrived_automatically boolean not null default false,
  add check ((dest_lat is null) = (dest_lng is null));

grant insert (kind, dest_lat, dest_lng) on public.walks to authenticated;

alter table public.private_profiles
  add column home_lat double precision check (home_lat between -90 and 90),
  add column home_lng double precision check (home_lng between -180 and 180),
  add column alert_guardians_on_missed boolean not null default false,
  add check ((home_lat is null) = (home_lng is null));

grant update (home_lat, home_lng, alert_guardians_on_missed) on public.private_profiles to authenticated;

-- When nearby guardians should hear about a missed check-in (null: never, or
-- already done), and when they did.
alter table public.incidents
  add column alert_guardians_at timestamptz,
  add column guardians_alerted_at timestamptz;

create index incidents_alert_guardians_idx on public.incidents (alert_guardians_at)
  where alert_guardians_at is not null;

-- Arrival radius, in metres.
create function public.trip_arrival_radius_m() returns double precision
language sql immutable as $$ select 75::double precision $$;

create or replace function public.on_walk_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'active' then
    raise exception 'This walk has already ended' using errcode = '22023';
  end if;
  -- Reaching the destination ends the trip.
  if new.status = 'active' and new.dest_lat is not null and new.lat is not null
     and (new.lat, new.lng) is distinct from (old.lat, old.lng)
     and public.haversine_m(new.lat, new.lng, new.dest_lat, new.dest_lng) <= public.trip_arrival_radius_m() then
    new.status := 'arrived';
    new.arrived_automatically := true;
  end if;
  if new.status <> 'active' and old.status = 'active' then
    new.ended_at := now();
  end if;
  if new.due_at <> old.due_at and new.due_at > now() + interval '3 hours' then
    raise exception 'A check-in can be at most 3 hours away' using errcode = '22023';
  end if;
  return new;
end $$;

revoke execute on function public.on_walk_update() from public, anon, authenticated;

-- How long after the circle is alerted guardians are, for people who opted in.
create function public.guardian_alert_grace() returns interval
language sql immutable as $$ select interval '5 minutes' $$;

-- Same as before, plus: guardians only for people who opted in, after a grace.
create or replace function public.escalate_overdue_walks(p_grace interval default interval '2 minutes')
returns table (walk_id uuid, incident_id uuid, requester_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  w record;
  v_incident uuid;
  v_guardians boolean;
begin
  for w in
    select * from walks
    where status = 'active' and due_at + p_grace < now()
    order by due_at
    for update skip locked
  loop
    select i.id into v_incident from incidents i where i.requester_id = w.user_id and i.status = 'active';
    if v_incident is null then
      select coalesce(p.alert_guardians_on_missed, false) into v_guardians
      from private_profiles p where p.id = w.user_id;
      insert into incidents (requester_id, mode, trigger, note, lat, lng, location_at, alert_guardians_at)
      values (
        w.user_id, w.mode, 'check_in_missed',
        left('Missed a check-in' || coalesce(' on the way to ' || nullif(trim(w.destination), ''), '')
             || '. Last location shared ' || coalesce(to_char(w.location_at at time zone 'UTC', 'HH24:MI') || ' UTC', 'at the start') || '.', 500),
        w.lat, w.lng, w.location_at,
        case when coalesce(v_guardians, false) then now() + public.guardian_alert_grace() end
      )
      returning id into v_incident;
    end if;
    update walks set status = 'escalated', incident_id = v_incident where id = w.id;
    walk_id := w.id;
    incident_id := v_incident;
    requester_id := w.user_id;
    return next;
  end loop;
end $$;

-- Missed check-ins whose guardian grace has run out while still open. Claims
-- them so each is sent once. Service role only.
create function public.claim_due_guardian_alerts()
returns table (incident_id uuid, requester_id uuid)
language sql security definer set search_path = public as $$
  update incidents i
  set alert_guardians_at = null, guardians_alerted_at = now()
  where i.alert_guardians_at is not null and i.alert_guardians_at <= now() and i.status = 'active'
  returning i.id, i.requester_id;
$$;

revoke execute on function public.escalate_overdue_walks(interval) from public, anon, authenticated;
revoke execute on function public.claim_due_guardian_alerts() from public, anon, authenticated;

-- Tells the check-ins function a trip started or arrived. Never blocks the
-- write: where Vault or pg_net isn't set up (local tests), it does nothing.
create function public.notify_trip_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event text;
  v_url text;
begin
  if tg_op = 'INSERT' then
    v_event := 'started';
  elsif new.status = 'arrived' and old.status = 'active' then
    v_event := 'arrived';
  else
    return null;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'hereo_project_url';
    if v_url is not null then
      perform net.http_post(
        url := v_url || '/functions/v1/check-ins',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.check_ins_secret()
        ),
        body := jsonb_build_object('event', v_event, 'walk_id', new.id)
      );
    end if;
  exception when others then
    raise warning 'trip event % not sent: %', v_event, sqlerrm;
  end;
  return null;
end $$;

revoke execute on function public.notify_trip_event() from public, anon, authenticated;

create trigger trip_event after insert or update of status on public.walks
  for each row execute function public.notify_trip_event();
