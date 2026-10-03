#!/usr/bin/env bash
# Applies the migrations to a scratch database and runs the RLS tests.
# Usage: supabase/tests/run.sh   (needs createdb/psql for a local Postgres)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${HEREO_TEST_DB:-hereo_test}
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
# The publication warns about wal_level on a stock Postgres; that is expected.
cat tests/supabase_stubs.sql migrations/*.sql | psql -X -q -v ON_ERROR_STOP=1 -d "$DB" 2> >(grep -v -e wal_level -e 'Set wal_level' >&2)
for t in tests/rls_test.sql tests/walks_test.sql tests/trips_test.sql; do
  psql -X -q -tA -v ON_ERROR_STOP=1 -d "$DB" -f "$t" 2>&1 | sed -n "s/.*NOTICE:  //p; /PASSED/p; /ERROR/p"
done
