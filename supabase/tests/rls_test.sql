-- Exercises the help loop's permissions end to end against the migration.
-- Run with: supabase/tests/run.sh (needs a local Postgres).
\set ON_ERROR_STOP 1

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok: % (%)', p_label, sqlerrm;
    return;
  end;
  raise exception 'expected failure: %', p_label;
end $$;

create function pg_temp.expect(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'failed: %', p_label; end if;
  raise notice 'ok: %', p_label;
end $$;

-- Users: alice asks for help, bob is in her circle, gina is a nearby
-- Her-O verified guardian, gary is a nearby guardian, eve is a stranger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'gina@example.com', '{"display_name":"Gina"}'),
  ('00000000-0000-0000-0000-00000000000d', 'gary@example.com', '{"display_name":"Gary"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.com', '{"display_name":"Eve"}');

select pg_temp.expect((select count(*) = 5 from profiles), 'signup creates profiles');

-- Guardian setup happens through the API, not by flipping columns.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($$update profiles set is_guardian = true where id = auth.uid()$$, 'cannot self-set is_guardian');
select pg_temp.expect_error($$select become_guardian()$$, 'become_guardian requires code of conduct');
insert into guardian_trainings (user_id, course) values (auth.uid(), 'code_of_conduct');
select pg_temp.expect_error($$insert into guardian_trainings (user_id, course) values (auth.uid(), 'first_aid')$$, 'cannot self-certify first aid');
select become_guardian();
update profiles set guardian_available = true where id = auth.uid();
update private_profiles set last_lat = 40.7130, last_lng = -74.0060, last_seen_at = now(), push_token = 'ExponentPushToken[gina]' where id = auth.uid();
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into guardian_trainings (user_id, course) values (auth.uid(), 'code_of_conduct');
select become_guardian();
update profiles set guardian_available = true where id = auth.uid();
update private_profiles set last_lat = 40.7140, last_lng = -74.0070, last_seen_at = now(), push_token = 'ExponentPushToken[gary]' where id = auth.uid();
reset role;

update profiles set her_o_verified = true where id = '00000000-0000-0000-0000-00000000000c';

-- Alice builds her circle and checks who is nearby.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select add_to_circle('BOB@example.com');
select pg_temp.expect_error($$select add_to_circle('nobody@example.com')$$, 'add_to_circle unknown email');
select pg_temp.expect((select guardians_nearby_count(40.7128, -74.0060)) = 2, 'two guardians nearby');
select pg_temp.expect((select guardians_nearby_count(40.7128, -74.0060, true)) = 1, 'one Her-O guardian nearby');
select pg_temp.expect((select guardians_nearby_count(40.80, -74.0060)) = 0, 'none 10km away');
select pg_temp.expect_error($$select * from nearby_guardians(40.7128, -74.0060)$$, 'clients cannot list guardians');
select pg_temp.expect((select count(*) = 0 from private_profiles where id <> auth.uid()), 'cannot read others private rows');

-- Alice asks for help.
insert into incidents (requester_id, mode, note, lat, lng, location_at)
values (auth.uid(), 'her_o', 'Someone is following me', 40.7128, -74.0060, now());
select pg_temp.expect_error($$insert into incidents (requester_id) values (auth.uid())$$, 'only one active incident');
select pg_temp.expect_error($$update incidents set urgency = 'low' where requester_id = auth.uid()$$, 'cannot write triage fields');
reset role;

-- The dispatch function (service role) picks responders.
select pg_temp.expect((select count(*) = 1 from nearby_guardians(40.7128, -74.0060, 1500, true)), 'service sees her-o guardian');
insert into incident_responders (incident_id, user_id, kind, role, distance_m)
select i.id, '00000000-0000-0000-0000-00000000000b'::uuid, 'circle', 'Call Alice now', null::integer from incidents i
union all
select i.id, '00000000-0000-0000-0000-00000000000c'::uuid, 'guardian', 'Walk to her and stay visible', 22 from incidents i;
update incidents set urgency = 'high', brief = 'Gina is on the way.', triage_source = 'ai', dispatched_at = now();

-- Gina responds; Gary was not picked and sees nothing.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) = 1 from incidents), 'guardian sees the incident');
update incident_responders set status = 'en_route' where user_id = auth.uid();
insert into incident_events (incident_id, actor_id, kind, body) select id, auth.uid(), 'message', 'Two minutes away' from incidents;
with u as (update incident_responders set status = 'on_scene' where user_id = '00000000-0000-0000-0000-00000000000b' returning 1)
select pg_temp.expect((select count(*) = 0 from u), 'cannot change another responder');
select pg_temp.expect_error($$insert into incident_events (incident_id, actor_id, kind, body) select id, '00000000-0000-0000-0000-00000000000a', 'message', 'spoof' from incidents$$, 'cannot post as someone else');
select pg_temp.expect((select count(*) = 1 from profiles where display_name = 'Alice'), 'guardian sees requester name');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect((select count(*) = 0 from incidents), 'unpicked guardian sees nothing');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) = 0 from incidents), 'stranger sees no incidents');
select pg_temp.expect((select count(*) = 0 from incident_events), 'stranger sees no events');
select pg_temp.expect((select count(*) = 0 from profiles where display_name = 'Alice'), 'stranger cannot see Alice');
reset role;

-- Alice is safe and thanks Gina.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update incidents set status = 'resolved' where requester_id = auth.uid();
insert into thanks (incident_id, from_id, to_id, message)
select id, auth.uid(), '00000000-0000-0000-0000-00000000000c', 'Thank you for walking me home' from incidents;
select pg_temp.expect_error($$insert into thanks (incident_id, from_id, to_id, message) select id, auth.uid(), '00000000-0000-0000-0000-00000000000e', 'x' from incidents$$, 'cannot thank a non-participant');
select pg_temp.expect_error($$update incidents set status = 'active' where requester_id = auth.uid()$$, 'cannot reopen');
reset role;

select pg_temp.expect((select resolved_at is not null from incidents), 'resolved_at set');
select pg_temp.expect((select bool_and(status = 'released') from incident_responders where user_id = '00000000-0000-0000-0000-00000000000b'), 'circle released');
select pg_temp.expect((select string_agg(kind, ',' order by id) from incident_events) = 'created,status,message,resolved', 'timeline: ' || (select string_agg(kind, ',' order by id) from incident_events));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) = 1 from top_guardians()), 'recognition is public');
reset role;

\echo ALL RLS TESTS PASSED
