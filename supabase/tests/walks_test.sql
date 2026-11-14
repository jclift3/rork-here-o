-- Walk with me and Her-O verification permissions. Runs after rls_test.sql
-- and reuses its users: Alice's circle includes Bob; Eve is a stranger.
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

-- Alice starts a walk home.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into walks (user_id, destination, due_at, lat, lng, location_at)
values (auth.uid(), 'Home', now() + interval '20 minutes', 40.7128, -74.0060, now());
select pg_temp.expect_error($$insert into walks (user_id, due_at) values (auth.uid(), now() + interval '10 minutes')$$, 'one active walk at a time');
select pg_temp.expect_error($$insert into walks (user_id, due_at) values ('00000000-0000-0000-0000-00000000000e', now() + interval '10 minutes')$$, 'cannot start a walk for someone else');
select pg_temp.expect_error($$update walks set due_at = now() + interval '5 hours' where user_id = auth.uid()$$, 'extension is capped');
select pg_temp.expect_error($$update walks set status = 'escalated' where user_id = auth.uid()$$, 'walker cannot mark escalated');
update walks set due_at = now() + interval '30 minutes', lat = 40.7135, lng = -74.0050, location_at = now() where user_id = auth.uid();
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) = 1 from walks), 'circle can follow the walk');
with u as (update walks set status = 'arrived' returning id) select pg_temp.expect((select count(*) = 0 from u), 'circle cannot end the walk');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) = 0 from walks), 'stranger cannot see the walk');
select pg_temp.expect_error($$select escalate_overdue_walks()$$, 'clients cannot run escalation');
reset role;

-- Nothing is overdue yet.
select pg_temp.expect((select count(*) = 0 from escalate_overdue_walks()), 'on-time walk is left alone');

-- Alice misses her check-in.
update walks set started_at = now() - interval '40 minutes', due_at = now() - interval '5 minutes'
  where user_id = '00000000-0000-0000-0000-00000000000a';
create temp table escalated as select * from escalate_overdue_walks();
select pg_temp.expect((select count(*) = 1 from escalated), 'overdue walk escalates');
select pg_temp.expect((select count(*) = 0 from escalate_overdue_walks()), 'escalation runs once');
select pg_temp.expect((select trigger = 'check_in_missed' and status = 'active' and lat = 40.7135 and note like 'Missed a check-in on the way to Home%'
                       from incidents i join escalated e on e.incident_id = i.id), 'incident carries last location and destination');
select pg_temp.expect((select w.status = 'escalated' and w.ended_at is not null and w.incident_id = e.incident_id
                       from walks w join escalated e on e.walk_id = w.id), 'walk links to its incident');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$update walks set status = 'arrived' where user_id = auth.uid() and status = 'escalated'$$, 'ended walk cannot change');
-- She can start a new walk once the old one has ended.
update incidents set status = 'resolved' where requester_id = auth.uid() and status = 'active';
insert into walks (user_id, due_at) values (auth.uid(), now() + interval '15 minutes');
update walks set status = 'arrived' where user_id = auth.uid() and status = 'active';
reset role;
select pg_temp.expect((select count(*) = 0 from escalate_overdue_walks()), 'arrived walk never escalates');

-- An open help request is reused, not duplicated.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into incidents (requester_id) values (auth.uid());
insert into walks (user_id, due_at) values (auth.uid(), now() + interval '15 minutes');
reset role;
update walks set started_at = now() - interval '30 minutes', due_at = now() - interval '5 minutes'
  where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'active';
select pg_temp.expect((select count(*) = 1 from escalate_overdue_walks()), 'second overdue walk escalates');
select pg_temp.expect((select count(*) = 1 from incidents where requester_id = '00000000-0000-0000-0000-00000000000a' and status = 'active'),
                      'existing open incident reused');

-- Her-O verification: request, review, approval flips the profile flag.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into her_o_verifications (user_id, note) values (auth.uid(), 'Evenings work best');
select pg_temp.expect_error($$update her_o_verifications set status = 'approved' where user_id = auth.uid()$$, 'cannot approve yourself');
select pg_temp.expect_error($$insert into her_o_verifications (user_id) values ('00000000-0000-0000-0000-00000000000a')$$, 'cannot file for someone else');
select pg_temp.expect((select status = 'pending' from her_o_verifications), 'request is pending');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) = 0 from her_o_verifications), 'requests are private');
reset role;

update her_o_verifications set status = 'approved' where user_id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect((select her_o_verified from profiles where id = '00000000-0000-0000-0000-00000000000e'), 'approval verifies the profile');
select pg_temp.expect((select reviewed_at is not null from her_o_verifications where user_id = '00000000-0000-0000-0000-00000000000e'), 'review time recorded');
update her_o_verifications set status = 'declined' where user_id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect((select not her_o_verified from profiles where id = '00000000-0000-0000-0000-00000000000e'), 'revoking unverifies');

\echo ALL WALK TESTS PASSED
