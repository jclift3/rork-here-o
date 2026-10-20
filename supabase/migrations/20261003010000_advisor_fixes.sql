-- Fixes from the Supabase security and performance advisors.
--
-- * Functions are executable by PUBLIC by default. Trigger functions should
--   not be callable over the API at all, and the app's RPCs and RLS helpers
--   are for signed-in users only.
-- * RLS policies call auth.uid() through a subselect so Postgres evaluates it
--   once per query instead of once per row.
-- * pg_net lives in the extensions schema, not public.

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.handle_new_user(),
  public.on_incident_created(),
  public.on_incident_status_change(),
  public.on_responder_status_change(),
  public.on_walk_update(),
  public.on_verification_review()
from public, anon, authenticated;

revoke execute on function
  public.is_incident_participant(uuid),
  public.shares_incident_or_circle(uuid),
  public.can_see_walk(uuid),
  public.guardians_nearby_count(double precision, double precision, boolean),
  public.add_to_circle(text),
  public.become_guardian(),
  public.top_guardians(integer)
from public, anon;

grant execute on function
  public.is_incident_participant(uuid),
  public.shares_incident_or_circle(uuid),
  public.can_see_walk(uuid),
  public.guardians_nearby_count(double precision, double precision, boolean),
  public.add_to_circle(text),
  public.become_guardian(),
  public.top_guardians(integer)
to authenticated;

alter function public.haversine_m(double precision, double precision, double precision, double precision)
  set search_path = '';

-- ---------------------------------------------------------------------------
-- RLS policies: evaluate auth.uid() once per query
-- ---------------------------------------------------------------------------

alter policy profiles_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy private_profiles_own on public.private_profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy circle_select on public.circle_members
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
alter policy circle_delete on public.circle_members
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));

alter policy trainings_select on public.guardian_trainings
  using (user_id = (select auth.uid()));
alter policy trainings_self_accept on public.guardian_trainings
  with check (user_id = (select auth.uid()) and course = 'code_of_conduct');

alter policy incidents_insert on public.incidents
  with check (requester_id = (select auth.uid()));
alter policy incidents_update on public.incidents
  using (requester_id = (select auth.uid())) with check (requester_id = (select auth.uid()));

alter policy responders_update_own on public.incident_responders
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status <> 'released');

alter policy events_insert on public.incident_events
  with check (actor_id = (select auth.uid()) and kind in ('message', 'escalated_911')
              and public.is_incident_participant(incident_id));

alter policy thanks_select on public.thanks
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
alter policy thanks_insert on public.thanks
  with check (from_id = (select auth.uid()) and public.is_incident_participant(incident_id)
              and exists (select 1 from public.incidents i where i.id = incident_id
                          and (i.requester_id = to_id
                               or exists (select 1 from public.incident_responders r where r.incident_id = i.id and r.user_id = to_id))));

alter policy walks_insert on public.walks
  with check (user_id = (select auth.uid()) and status = 'active');
alter policy walks_update on public.walks
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status <> 'escalated');

alter policy verifications_select on public.her_o_verifications
  using (user_id = (select auth.uid()));
alter policy verifications_insert on public.her_o_verifications
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Indexes for foreign keys used in lookups and cascades
-- ---------------------------------------------------------------------------

create index if not exists circle_members_member_idx on public.circle_members (member_id);
create index if not exists incident_events_actor_idx on public.incident_events (actor_id);
create index if not exists thanks_from_idx on public.thanks (from_id);
create index if not exists thanks_to_idx on public.thanks (to_id);
create index if not exists walks_incident_idx on public.walks (incident_id);

-- ---------------------------------------------------------------------------
-- pg_net out of public. Its functions stay in the net schema, so the
-- check-ins cron job is unaffected.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net schema extensions;
  end if;
end $$;
