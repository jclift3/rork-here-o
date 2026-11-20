-- Report, block and terms acceptance. Run with: supabase/tests/run.sh
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

-- Rosa and Hal share a circle; Una has never met either of them.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'rosa@example.com', '{"display_name":"Rosa"}'),
  ('00000000-0000-0000-0000-0000000005a2', 'hal@example.com', '{"display_name":"Hal"}'),
  ('00000000-0000-0000-0000-0000000005a3', 'una@example.com', '{"display_name":"Una"}');
insert into circle_members (owner_id, member_id) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2');

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a1');
select pg_temp.expect(report_user('00000000-0000-0000-0000-0000000005a2', 'harassment', null, null, ' rude ') > 0, 'report someone you know');
select pg_temp.expect((select count(*) = 1 from user_reports), 'reporter sees own report');
select pg_temp.expect((select details = 'rude' from user_reports), 'details trimmed');
select report_user('00000000-0000-0000-0000-0000000005a2', 'harassment');
select pg_temp.expect((select count(*) = 1 from user_reports), 'repeat report is not duplicated');
select pg_temp.expect_error($$select report_user('00000000-0000-0000-0000-0000000005a3', 'unsafe')$$, 'cannot report someone never met');
select pg_temp.expect_error($$select report_user(auth.uid(), 'unsafe')$$, 'cannot report yourself');
select pg_temp.expect_error($$select report_user('00000000-0000-0000-0000-0000000005a2', 'spam')$$, 'reason must be known');
select pg_temp.expect_error($$insert into user_reports (reporter_id, reported_id, reason) values (auth.uid(), '00000000-0000-0000-0000-0000000005a3', 'other')$$, 'no direct insert');
select pg_temp.expect_error($$update user_reports set status = 'dismissed'$$, 'reporter cannot change status');

select block_user('00000000-0000-0000-0000-0000000005a2');
select pg_temp.expect((select count(*) = 1 from user_blocks), 'block recorded');
select pg_temp.expect((select count(*) = 0 from circle_members where owner_id = auth.uid()), 'block ends the circle link');
select pg_temp.expect_error($$select blocked_ids(auth.uid())$$, 'blocked_ids is service only');
select pg_temp.expect_error($$insert into user_blocks values (auth.uid(), '00000000-0000-0000-0000-0000000005a3')$$, 'no direct block insert');
delete from user_blocks where blocked_id = '00000000-0000-0000-0000-0000000005a2';
select pg_temp.expect((select count(*) = 0 from user_blocks), 'unblock');
reset role;

-- Hal cannot see Rosa's report about him.
select pg_temp.as_user('00000000-0000-0000-0000-0000000005a2');
select pg_temp.expect((select count(*) = 0 from user_reports), 'reported person cannot see the report');
reset role;

insert into user_blocks values ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005a1');
select pg_temp.expect(
  blocked_ids('00000000-0000-0000-0000-0000000005a1') = array['00000000-0000-0000-0000-0000000005a2']::uuid[],
  'blocks apply in both directions'
);

select pg_temp.as_user('00000000-0000-0000-0000-0000000005a3');
select accept_terms('2026-11');
select accept_terms('2026-11');
select pg_temp.expect((select count(*) = 1 from terms_acceptances), 'terms acceptance recorded once');
select pg_temp.expect_error($$insert into terms_acceptances values (auth.uid(), 'x', now())$$, 'no direct terms insert');
reset role;

\echo ALL LAUNCH SAFETY TESTS PASSED
