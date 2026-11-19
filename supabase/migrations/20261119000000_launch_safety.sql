-- Launch safety (build 7): report and block (App Store guideline 1.2, user
-- content) and a record of which terms each person accepted.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

-- A report about another person, usually from inside a help request. Only
-- the HereO team (service role) reads these; the reporter sees their own.
create table public.user_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid references public.profiles (id) on delete set null,
  incident_id uuid references public.incidents (id) on delete set null,
  event_id bigint,
  reason text not null check (reason in ('unsafe', 'harassment', 'false_alarm', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (reporter_id <> reported_id)
);

create index user_reports_open_idx on public.user_reports (created_at) where status = 'open';

alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;
grant select on public.user_reports to authenticated;
create policy user_reports_own on public.user_reports for select to authenticated
  using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

-- A block keeps two people apart: neither is sent to the other's help
-- requests or rung for them, and the blocker stops seeing their messages.
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
create policy user_blocks_own_select on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy user_blocks_own_delete on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Report someone you met through HereO, and optionally block them. You can
-- only report people you share a help request or circle with.
create function public.report_user(
  p_reported uuid,
  p_reason text,
  p_incident uuid default null,
  p_event bigint default null,
  p_details text default null,
  p_block boolean default false
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_reported is null or p_reported = auth.uid() then raise exception 'choose someone else to report'; end if;
  if p_reason is null or p_reason not in ('unsafe', 'harassment', 'false_alarm', 'other') then
    raise exception 'unknown reason';
  end if;
  if not shares_incident_or_circle(p_reported) then
    raise exception 'you can only report people you have met through HereO';
  end if;
  if p_incident is not null and not is_incident_participant(p_incident) then
    raise exception 'not part of this help request';
  end if;
  -- One open report per person per help request is enough.
  select id into v_id from user_reports
  where reporter_id = auth.uid() and reported_id = p_reported
    and incident_id is not distinct from p_incident and status = 'open';
  if v_id is null then
    insert into user_reports (reporter_id, reported_id, incident_id, event_id, reason, details)
    values (auth.uid(), p_reported, p_incident, p_event, p_reason, nullif(trim(p_details), ''))
    returning id into v_id;
  end if;
  if p_block then
    insert into user_blocks (blocker_id, blocked_id) values (auth.uid(), p_reported)
    on conflict do nothing;
  end if;
  return v_id;
end $$;

create function public.block_user(p_blocked uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_blocked is null or p_blocked = auth.uid() then raise exception 'choose someone else to block'; end if;
  if not shares_incident_or_circle(p_blocked) then
    raise exception 'you can only block people you have met through HereO';
  end if;
  insert into user_blocks (blocker_id, blocked_id) values (auth.uid(), p_blocked) on conflict do nothing;
  -- A block also ends any circle link between the two.
  delete from circle_members
  where (owner_id = auth.uid() and member_id = p_blocked) or (owner_id = p_blocked and member_id = auth.uid());
end $$;

-- Everyone kept apart from p_user, in either direction. Dispatch and the
-- ring exclude these people. Service role only.
create function public.blocked_ids(p_user uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select blocked_id as x from user_blocks where blocker_id = p_user
    union all
    select blocker_id from user_blocks where blocked_id = p_user
  ) s;
$$;

revoke execute on function public.report_user(uuid, text, uuid, bigint, text, boolean),
  public.block_user(uuid), public.blocked_ids(uuid) from public, anon;
grant execute on function public.report_user(uuid, text, uuid, bigint, text, boolean),
  public.block_user(uuid) to authenticated;
revoke execute on function public.blocked_ids(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- Terms acceptance
-- ---------------------------------------------------------------------------

create table public.terms_acceptances (
  user_id uuid not null references public.profiles (id) on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;
create policy terms_acceptances_own on public.terms_acceptances for select to authenticated
  using (user_id = auth.uid());

create function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  insert into terms_acceptances (user_id, version) values (auth.uid(), p_version) on conflict do nothing;
end $$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review and demo accounts
-- ---------------------------------------------------------------------------

-- Accounts for App Review and demos. A demo account's help request is
-- answered only by demo heroes, who are placed near it by the dispatcher; no
-- real person is alerted or rung, and demo heroes are never sent to real
-- people. Set by the HereO team (service role) only.
alter table public.profiles add column if not exists is_demo boolean not null default false;
