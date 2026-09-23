#!/bin/sh
# Proves RLS isolation, the tick and uncheck rules, the invite flow and archiving.
#   DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres supabase/check/check.sh
# runs against a `supabase start` stack (migrations already applied). Without
# DB_URL it applies the migrations to a throwaway local Postgres instead.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
run() { psql "$1" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$2"; }

if [ -n "${DB_URL:-}" ]; then
  run "$DB_URL" "$here/rls.sql"
  exit
fi

tmp=$(mktemp -d)
trap 'pg_ctl -D "$tmp/db" -m immediate stop >/dev/null 2>&1; rm -rf "$tmp"' EXIT
initdb -D "$tmp/db" -U postgres -A trust >/dev/null
pg_ctl -D "$tmp/db" -o "-k $tmp -c listen_addresses= -c wal_level=logical" -l "$tmp/log" -w start >/dev/null
url="postgresql://postgres@/postgres?host=$tmp"
run "$url" "$here/supabase_stub.sql"
for f in "$here"/../migrations/*.sql; do run "$url" "$f"; done
run "$url" "$here/rls.sql"
