-- HereO ring: who is rung, what neighbours can see, PIN and duress, false
-- alarms. Runs after trips_test.sql and reuses rls_test.sql's users: Alice
-- asks for help, Bob is in her circle, Eve and Gary are neighbours, Gina is a
-- verified Her-O who drives.
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

update incidents set status = 'resolved' where status = 'active';

-- Alice: 40.7128, -74.0060. About 111 m per 0.001 degree of latitude.
update private_profiles set ring_opt_in = true, last_lat = 40.71325, last_lng = -74.0060, last_seen_at = now()
  where id = '00000000-0000-0000-0000-00000000000e';                                  -- Eve, 50 m, on foot
update private_profiles set ring_opt_in = true, last_lat = 40.7191, last_lng = -74.0060, last_seen_at = now()
  where id = '00000000-0000-0000-0000-00000000000d';                                  -- Gary, 700 m, on foot
update private_profiles set ring_opt_in = true, ring_travel = 'drive', last_lat = 40.7236, last_lng = -74.0060, last_seen_at = now()
  where id = '00000000-0000-0000-0000-00000000000c';                                  -- Gina, 1.2 km, drives
update private_profiles set ring_opt_in = true, last_lat = 40.7130, last_lng = -74.0060, last_seen_at = now()
  where id = '00000000-0000-0000-0000-00000000000b';                                  -- Bob, circle

-- Settings are the user's own to change.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
update private_profiles set ring_travel = 'foot', alarm_style = 'silent' where id = auth.uid();
select pg_temp.expect((select alarm_style = 'silent' from private_profiles where id = auth.uid()), 'alarm style saved');
select pg_temp.expect_error($$update private_profiles set ring_travel = 'fly' where id = auth.uid()$$, 'travel is foot or drive');
select pg_temp.expect_error($$select * from nearby_ring_responders(40.7128, -74.0060)$$, 'clients cannot list neighbours');
select pg_temp.expect_error($$select ring_strikes(auth.uid())$$, 'clients cannot read strikes directly');
select pg_temp.expect_error($$select * from ring_secrets$$, 'PIN hashes are hidden');
reset role;

-- Matching.
select pg_temp.expect((select array_agg(user_id order by distance_m) = array[
                         '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000d',
                         '00000000-0000-0000-0000-00000000000c']::uuid[]
                       from nearby_ring_responders(40.7128, -74.0060, false, array['00000000-0000-0000-0000-00000000000a',
                         '00000000-0000-0000-0000-00000000000b']::uuid[])), 'walkers within half a mile, drivers within a mile, circle excluded');
select pg_temp.expect((select array_agg(user_id) = array['00000000-0000-0000-0000-00000000000c']::uuid[]
                       from nearby_ring_responders(40.7128, -74.0060, true, array['00000000-0000-0000-0000-00000000000b']::uuid[])),
                      'Her-O requests ring verified Her-Os only');
update private_profiles set last_lat = 40.7209 where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.expect((select count(*) = 0 from nearby_ring_responders(40.7128, -74.0060) where user_id = '00000000-0000-0000-0000-00000000000d'),
                      'a walker 900 m away is not rung');
update private_profiles set last_lat = 40.7191, last_seen_at = now() - interval '30 minutes' where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.expect((select count(*) = 0 from nearby_ring_responders(40.7128, -74.0060) where user_id = '00000000-0000-0000-0000-00000000000d'),
                      'a stale location is not rung');
update private_profiles set last_seen_at = now() where id = '00000000-0000-0000-0000-00000000000d';

-- Fifteen more neighbours: twelve within 100 m are all rung, the three further
-- away are not, because the ring is already past ten people.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'n' || n || '@example.com'
from generate_series(1, 15) n;
update private_profiles set ring_opt_in = true, last_seen_at = now(), last_lng = -74.0060,
       last_lat = 40.7128 + case when n <= 12 then 0.0008 else 0.004 end
from (select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid as id, n from generate_series(1, 15) n) x
where private_profiles.id = x.id;
select pg_temp.expect((select count(*) = 13 and max(distance_m) <= 100
                       from nearby_ring_responders(40.7128, -74.0060, false, array['00000000-0000-0000-0000-00000000000b']::uuid[])),
                      'everyone within 100 m is rung even past ten');
select pg_temp.expect((select count(*) = 10
                       from nearby_ring_responders(40.7150, -74.0060, false, array['00000000-0000-0000-0000-00000000000b']::uuid[])),
                      'otherwise the ring stops at the nearest ten');
update private_profiles set ring_opt_in = false where id::text like '00000000-0000-0000-0000-0000000001%';

-- Banned accounts are never rung.
insert into ring_secrets (user_id, banned_at) values ('00000000-0000-0000-0000-00000000000d', now());
select pg_temp.expect((select count(*) = 0 from nearby_ring_responders(40.7128, -74.0060) where user_id = '00000000-0000-0000-0000-00000000000d'),
                      'banned accounts are not rung');
update ring_secrets set banned_at = null where user_id = '00000000-0000-0000-0000-00000000000d';

-- Alice sets her PINs.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$select set_ring_pin('cancel', '12a4')$$, 'PIN is digits');
select pg_temp.expect_error($$select set_ring_pin('duress', '9999')$$, 'duress PIN needs a PIN first');
select set_ring_pin('cancel', '1234');
select pg_temp.expect_error($$select set_ring_pin('duress', '9999')$$, 'changes need the current PIN');
select pg_temp.expect_error($$select set_ring_pin('duress', '1234', '1234')$$, 'duress PIN must differ');
select set_ring_pin('duress', '9999', '1234');
select pg_temp.expect((select has_pin and has_duress and strikes = 0 and not limited from ring_pin_status()), 'PINs set');

-- Alice raises a loud request; the ring function rings Eve and Gary.
-- The app inserts and reads the row back in one statement.
with i as (insert into incidents (requester_id, trigger, alarm, lat, lng, location_at)
           values (auth.uid(), 'hold', 'loud', 40.7128, -74.0060, now()) returning id)
select pg_temp.expect(count(*) = 1, 'a request can be created and read back in one statement') from i;
reset role;
insert into incident_responders (incident_id, user_id, kind)
select id, '00000000-0000-0000-0000-00000000000b', 'circle' from incidents where status = 'active';
insert into ring_responders (incident_id, user_id, travel, distance_m)
select i.id, n.user_id, n.travel, n.distance_m
from incidents i, nearby_ring_responders(i.lat, i.lng, false, array['00000000-0000-0000-0000-00000000000a',
       '00000000-0000-0000-0000-00000000000b']::uuid[]) n
where i.status = 'active' and n.user_id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000d');
update incidents set ring_at = now() where status = 'active';

-- Eve sees a pin and a distance, never who Alice is.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select active and lat = 40.7128 and distance_m = 50 and my_status = 'notified' and rung = 2 and going = 0
                       from ring_card((select incident_id from my_active_rings()))), 'neighbour card shows the pin');
select pg_temp.expect((select count(*) = 0 from incidents where requester_id = '00000000-0000-0000-0000-00000000000a'), 'neighbour cannot read the request');
select pg_temp.expect((select count(*) = 0 from incident_events where incident_id = (select incident_id from my_active_rings())), 'neighbour cannot read the timeline');
select pg_temp.expect((select count(*) = 0 from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'neighbour cannot see her name');
select pg_temp.expect((select count(*) = 1 from ring_responders), 'neighbour sees only their own ring row');
select respond_to_ring((select incident_id from my_active_rings()), 'en_route');
select pg_temp.expect_error($$select respond_to_ring((select incident_id from my_active_rings()), 'released')$$, 'cannot release yourself');
select pg_temp.expect_error($$update ring_responders set status = 'on_scene'$$, 'no direct writes');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect((select going = 1 and distance_m = 701 from ring_card((select incident_id from my_active_rings()))), 'others see one going');
select pg_temp.expect((select count(*) = 0 from ring_card((select id from incidents limit 1))), 'Gary has no other cards');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) = 0 from ring_card((select incident_id from incident_responders where user_id = auth.uid() limit 1))),
                      'circle members get no neighbour card');
reset role;

-- Alice sees how many neighbours are coming.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) = 2 and count(*) filter (where status = 'en_route') = 1 from ring_responders),
                      'she sees her neighbours count');
select pg_temp.expect_error($$select end_help_request((select id from incidents where status = 'active'), 'resolved', '0000')$$, 'wrong PIN refused');
select pg_temp.expect_error($$select end_help_request((select id from incidents where status = 'active'))$$, 'PIN required');
select pg_temp.expect((select end_help_request((select id from incidents where status = 'active'), 'resolved', '9999') = 'duress'), 'duress PIN looks like a cancel');
select pg_temp.expect((select status = 'active' and duress_at is not null from incidents where requester_id = auth.uid() order by created_at desc limit 1),
                      'duress keeps the request open');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select active from ring_card((select incident_id from my_active_rings()))), 'neighbours still rung after duress');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select end_help_request((select id from incidents where status = 'active'), 'resolved', '1234') = 'closed'), 'PIN closes it');
reset role;
select pg_temp.expect((select bool_and(status = 'released') from ring_responders), 'neighbours released');

-- After it ends: no pin, and false alarm reports.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) = 0 from my_active_rings()), 'ended ring leaves home');
select pg_temp.expect((select not active and lat is null and lng is null
                       from ring_card((select incident_id from ring_responders limit 1))), 'pin hidden once it ends');
select pg_temp.expect_error($$select respond_to_ring((select incident_id from ring_responders limit 1), 'en_route')$$, 'cannot respond once it ends');
select report_false_ring((select incident_id from ring_responders limit 1));
reset role;
select pg_temp.expect((select ring_strikes('00000000-0000-0000-0000-00000000000a') = 0), 'one report is not a strike');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select report_false_ring((select incident_id from ring_responders limit 1));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select strikes = 1 and not limited from ring_pin_status()), 'two reports make a strike');
select pg_temp.expect_error($$select set_ring_pin('cancel', null)$$, 'clearing the PIN needs it');
select set_ring_pin('cancel', null, '1234');
select pg_temp.expect((select not has_pin and not has_duress from ring_pin_status()), 'clearing the PIN clears the duress PIN');
reset role;

\echo ALL RING TESTS PASSED
