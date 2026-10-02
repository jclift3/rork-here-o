-- Walk with me, check-in timers, and Her-O verification requests.
--
-- * A walk is a check-in timer with an optional destination. The walker's
--   circle can follow it live. If the walker doesn't check in by due_at plus a
--   short grace period, the check-ins function (run every minute by pg_cron)
--   turns it into a help request with trigger 'check_in_missed' and dispatches
--   it like any other.
-- * Her-O verification is a request the user files and the HereO team reviews
--   (service role). Approval flips profiles.her_o_verified.

-- ---------------------------------------------------------------------------
-- Walks
-- ---------------------------------------------------------------------------

create type public.walk_status as enum ('active', 'arrived', 'cancelled', 'escalated');

create table public.walks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode public.help_mode not null default 'here_o',
  status public.walk_status not null default 'active',
  destination text check (char_length(destination) <= 120),
  started_at timestamptz not null default now(),
  -- When the walker expects to check in. Extending moves it forward.
  due_at timestamptz not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  location_at timestamptz,
  ended_at timestamptz,
  -- Set when a missed check-in became a help request.
  incident_id uuid references public.incidents (id) on delete set null,
  check (due_at > started_at and due_at <= started_at + interval '6 hours')
);

create index walks_user_idx on public.walks (user_id, started_at desc);
create unique index walks_one_active_idx on public.walks (user_id) where status = 'active';
create index walks_due_idx on public.walks (due_at) where status = 'active';

-- Extending is capped so a walk can't silently run for days.
create function public.on_walk_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'active' then
    raise exception 'This walk has already ended' using errcode = '22023';
  end if;
  if new.status <> 'active' and old.status = 'active' then
    new.ended_at := now();
  end if;
  if new.due_at <> old.due_at and new.due_at > now() + interval '3 hours' then
    raise exception 'A check-in can be at most 3 hours away' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger walk_update before update on public.walks
  for each row execute function public.on_walk_update();

-- Walks the walker's circle can see: theirs, while active or recently ended.
create function public.can_see_walk(p_walker uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_walker = auth.uid()
      or exists (select 1 from circle_members c where c.owner_id = p_walker and c.member_id = auth.uid());
$$;

-- Turns overdue walks into help requests. Service role only; returns the
-- incidents that still need dispatching. Reuses an already open incident
-- instead of creating a second one.
create function public.escalate_overdue_walks(p_grace interval default interval '2 minutes')
returns table (walk_id uuid, incident_id uuid, requester_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  w record;
  v_incident uuid;
begin
  for w in
    select * from walks
    where status = 'active' and due_at + p_grace < now()
    order by due_at
    for update skip locked
  loop
    select i.id into v_incident from incidents i where i.requester_id = w.user_id and i.status = 'active';
    if v_incident is null then
      insert into incidents (requester_id, mode, trigger, note, lat, lng, location_at)
      values (
        w.user_id, w.mode, 'check_in_missed',
        left('Missed a check-in' || coalesce(' on the way to ' || nullif(trim(w.destination), ''), '')
             || '. Last location shared ' || coalesce(to_char(w.location_at at time zone 'UTC', 'HH24:MI') || ' UTC', 'at the start') || '.', 500),
        w.lat, w.lng, w.location_at
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

alter table public.walks enable row level security;
revoke all on public.walks from anon, authenticated;
grant select on public.walks to authenticated;
grant insert (user_id, mode, destination, due_at, lat, lng, location_at) on public.walks to authenticated;
grant update (status, due_at, lat, lng, location_at) on public.walks to authenticated;
create policy walks_select on public.walks for select to authenticated
  using (public.can_see_walk(user_id) and (status = 'active' or started_at > now() - interval '1 day'));
create policy walks_insert on public.walks for insert to authenticated
  with check (user_id = auth.uid() and status = 'active');
-- The walker can check in, cancel, extend, and share location. Only the
-- check-ins function can escalate.
create policy walks_update on public.walks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status <> 'escalated');

revoke execute on function public.escalate_overdue_walks from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Her-O verification
-- ---------------------------------------------------------------------------

create table public.her_o_verifications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  -- What the person wants us to know, e.g. a preferred time for the video check.
  note text check (char_length(note) <= 500),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- Shown to the user when declined.
  review_note text check (char_length(review_note) <= 500)
);

create function public.on_verification_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
    update profiles set her_o_verified = (new.status = 'approved') where id = new.user_id;
  end if;
  return new;
end $$;

create trigger verification_review before update of status on public.her_o_verifications
  for each row execute function public.on_verification_review();

alter table public.her_o_verifications enable row level security;
revoke all on public.her_o_verifications from anon, authenticated;
grant select, insert (user_id, note) on public.her_o_verifications to authenticated;
create policy verifications_select on public.her_o_verifications for select to authenticated
  using (user_id = auth.uid());
create policy verifications_insert on public.her_o_verifications for insert to authenticated
  with check (user_id = auth.uid());

-- Live updates for people following a walk.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.walks;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Run the check-ins function every minute.
--
-- Needs two Vault secrets, set once per project in the SQL editor:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service role key>', 'service_role_key');
-- Skipped where pg_cron or pg_net isn't available (local tests).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule(
      'hereo-check-ins',
      '* * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-ins',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end $$;
