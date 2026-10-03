-- Trips: arrival, circle-only missed check-ins, guardian opt-in. Runs after
-- walks_test.sql and reuses rls_test.sql's users (Bob, Eve).
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

-- Record what the trip_event triggers would send (the real function needs
-- Vault and pg_net).
create table trip_event_log (walk_id uuid, event text);
create or replace function public.notify_trip_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then insert into trip_event_log values (new.id, 'started');
  elsif new.status = 'arrived' and old.status = 'active' then insert into trip_event_log values (new.id, 'arrived');
  end if;
  return null;
end $$;

-- Start from no open requests.
update incidents set status = 'resolved' where status = 'active';

-- Bob saves home and opts in to guardian alerts.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update private_profiles set home_lat = 40.7300, home_lng = -73.9950, alert_guardians_on_missed = true where id = auth.uid();
select pg_temp.expect((select alert_guardians_on_missed and home_lat = 40.73 from private_profiles where id = auth.uid()), 'settings saved');

-- A run home.
insert into walks (user_id, kind, destination, dest_lat, dest_lng, due_at, lat, lng, location_at)
values (auth.uid(), 'run', 'Home', 40.7300, -73.9950, now() + interval '30 minutes', 40.7128, -74.0060, now());
select pg_temp.expect_error($$insert into walks (user_id, due_at, dest_lat) values (auth.uid(), now() + interval '10 minutes', 40.7)$$, 'destination needs both coordinates');
update walks set lat = 40.7200, lng = -74.0000, location_at = now() where user_id = auth.uid() and status = 'active';
select pg_temp.expect((select status = 'active' from walks where user_id = auth.uid() order by started_at desc limit 1), 'still running far from home');
update walks set lat = 40.7303, lng = -73.9953, location_at = now() where user_id = auth.uid() and status = 'active';
select pg_temp.expect((select status = 'arrived' and arrived_automatically and ended_at is not null and kind = 'run'
                       from walks where user_id = auth.uid() order by started_at desc limit 1), 'reaching home ends the trip');
reset role;
select pg_temp.expect((select array_agg(event order by event) = array['arrived', 'started'] from trip_event_log
                       where walk_id = (select id from walks where user_id = '00000000-0000-0000-0000-00000000000b'
                                        order by started_at desc limit 1)), 'circle told at start and on automatic arrival');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$select claim_due_guardian_alerts()$$, 'clients cannot claim guardian alerts');
reset role;

-- Eve has not opted in: a missed check-in is circle only.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into walks (user_id, due_at, lat, lng, location_at) values (auth.uid(), now() + interval '10 minutes', 40.71, -74.0, now());
reset role;
update walks set started_at = now() - interval '30 minutes', due_at = now() - interval '5 minutes'
  where user_id = '00000000-0000-0000-0000-00000000000e' and status = 'active';
create temp table eve_escalated as select * from escalate_overdue_walks();
select pg_temp.expect((select alert_guardians_at is null from incidents i join eve_escalated e on e.incident_id = i.id), 'opted out: guardians never alerted');

-- Bob opted in: guardians follow after the grace, once.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into walks (user_id, kind, due_at, lat, lng, location_at) values (auth.uid(), 'ride', now() + interval '10 minutes', 40.71, -74.0, now());
reset role;
update walks set started_at = now() - interval '30 minutes', due_at = now() - interval '5 minutes'
  where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active';
create temp table bob_escalated as select * from escalate_overdue_walks();
select pg_temp.expect((select alert_guardians_at between now() + interval '4 minutes' and now() + interval '6 minutes'
                       from incidents i join bob_escalated e on e.incident_id = i.id), 'opted in: guardians scheduled after grace');
select pg_temp.expect((select count(*) = 0 from claim_due_guardian_alerts()), 'not before the grace');
update incidents set alert_guardians_at = now() - interval '1 second' where id = (select incident_id from bob_escalated);
select pg_temp.expect((select count(*) = 1 from claim_due_guardian_alerts()), 'guardians claimed after the grace');
select pg_temp.expect((select count(*) = 0 from claim_due_guardian_alerts()), 'guardians claimed once');
select pg_temp.expect((select guardians_alerted_at is not null from incidents where id = (select incident_id from bob_escalated)), 'guardian alert time recorded');

-- Answering before the grace cancels the guardian alert.
update incidents set status = 'resolved' where id = (select incident_id from bob_escalated);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into walks (user_id, due_at, lat, lng, location_at) values (auth.uid(), now() + interval '10 minutes', 40.71, -74.0, now());
reset role;
update walks set started_at = now() - interval '30 minutes', due_at = now() - interval '5 minutes'
  where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active';
create temp table bob_again as select * from escalate_overdue_walks();
update incidents set status = 'resolved' where id = (select incident_id from bob_again);
update incidents set alert_guardians_at = now() - interval '1 second' where id = (select incident_id from bob_again);
select pg_temp.expect((select count(*) = 0 from claim_due_guardian_alerts()), 'answered request never reaches guardians');

\echo ALL TRIP TESTS PASSED
