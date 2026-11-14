-- Muse Dispatcher (built for the Meta Global AI Developer Hackathon, Nov 2026).
--
-- * agent_decisions: every tool call the Muse Spark agent makes on an
--   incident, with what the deterministic guard did to it (allowed, changed or
--   blocked) and why. Participants can read it; only the service role writes.
-- * incident_events gains 'voice' (a Muse Voice Transcribe transcript),
--   'scene' (a privacy-blurred photo plus a landmark description) and 'agent'
--   (a note the agent posts to everyone on the incident).
-- * incidents.scene_path points at the latest blurred scene photo in the
--   private 'scenes' bucket. Unblurred photos are never stored.
-- * agent_eval_runs: results of the scripted scenario evals.

alter table public.incident_events drop constraint if exists incident_events_kind_check;
alter table public.incident_events add constraint incident_events_kind_check
  check (kind in ('created', 'triaged', 'brief', 'message', 'status', 'escalated_911', 'resolved', 'cancelled',
                  'voice', 'scene', 'agent'));

alter table public.incidents add column if not exists scene_path text;
alter table public.incidents add column if not exists agent_model text;

create table if not exists public.agent_decisions (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  run_id uuid not null,
  -- 'dispatch' (first response) or 'reassess' (after new voice, scene or messages).
  phase text not null check (phase in ('dispatch', 'reassess')),
  step integer not null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  verdict text not null check (verdict in ('allowed', 'changed', 'blocked')),
  reason text,
  model text not null,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists agent_decisions_incident_idx on public.agent_decisions (incident_id, id);

alter table public.agent_decisions enable row level security;
grant select on public.agent_decisions to authenticated;
drop policy if exists agent_decisions_select on public.agent_decisions;
create policy agent_decisions_select on public.agent_decisions for select to authenticated
  using (public.is_incident_participant(incident_id));

create table if not exists public.agent_eval_runs (
  id bigint generated always as identity primary key,
  model text not null,
  scenarios integer not null,
  passed integer not null,
  guard_interventions integer not null,
  unsafe_tool_calls_blocked integer not null,
  emergency_recall numeric not null,
  median_latency_ms integer,
  details jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.agent_eval_runs enable row level security;
-- No policies: service role only.

-- Realtime for the coordinator panel.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'agent_decisions') then
    alter publication supabase_realtime add table public.agent_decisions;
  end if;
end $$;

-- Private bucket for blurred scene photos. Participants of the incident can
-- read them; only the scene function (service role) writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scenes', 'scenes', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists scenes_participant_read on storage.objects;
create policy scenes_participant_read on storage.objects for select to authenticated
  using (bucket_id = 'scenes'
         and public.is_incident_participant(((storage.foldername(name))[1])::uuid));
