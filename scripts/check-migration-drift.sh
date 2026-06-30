#!/usr/bin/env bash
# check-migration-drift.sh
# Compares local migration files in supabase/migrations/ against what Supabase
# reports as applied. Run from the repo root.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://..." ./scripts/check-migration-drift.sh
#
# Requires: psql (postgresql-client)

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: $MIGRATIONS_DIR not found. Run from repo root." >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: Set SUPABASE_DB_URL to the Supabase connection string." >&2
  echo "  Example: SUPABASE_DB_URL='postgresql://postgres.xxx:password@host:port/postgres'" >&2
  exit 1
fi

# Local migration versions (filename prefix before the first underscore)
local_versions=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | xargs -I{} basename {} | sed 's/_.*//' | sort)
local_count=$(echo "$local_versions" | wc -l | tr -d ' ')

# Remote applied versions from Supabase's migration history table
remote_versions=$(psql "$SUPABASE_DB_URL" -t -A -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" 2>/dev/null || true)

if [ -z "$remote_versions" ]; then
  echo "WARNING: Could not read supabase_migrations.schema_migrations."
  echo "  Either the connection failed or the table doesn't exist."
  echo "  Local migrations ($local_count files):"
  echo "$local_versions" | sed 's/^/    /'
  exit 2
fi

remote_count=$(echo "$remote_versions" | wc -l | tr -d ' ')

echo "Local migrations:  $local_count"
echo "Remote migrations: $remote_count"
echo ""

# Find migrations that exist locally but aren't applied remotely
not_applied=$(comm -23 <(echo "$local_versions") <(echo "$remote_versions" | sort))
# Find migrations applied remotely but missing locally (deleted files?)
orphaned=$(comm -13 <(echo "$local_versions") <(echo "$remote_versions" | sort))

drift=0

if [ -n "$not_applied" ]; then
  echo "NOT APPLIED (local file exists, not in remote):"
  echo "$not_applied" | sed 's/^/  !! /'
  drift=1
fi

if [ -n "$orphaned" ]; then
  echo "ORPHANED (applied remotely, no local file):"
  echo "$orphaned" | sed 's/^/  ?? /'
  drift=1
fi

if [ "$drift" -eq 0 ]; then
  echo "OK — no drift detected."
  exit 0
else
  echo ""
  echo "DRIFT DETECTED — review the items above."
  exit 1
fi
