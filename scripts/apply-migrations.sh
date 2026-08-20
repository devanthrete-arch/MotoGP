#!/usr/bin/env bash
#
# Apply supabase/migrations in timestamp order, exactly once each.
#
# Why this exists: migrations are applied by hand today (MCP / SQL editor), so
# "what is actually applied to production" lives only in someone's memory. This
# script makes the ledger authoritative and the operation repeatable from a
# laptop or from .github/workflows/migrate.yml.
#
# Ledger: supabase_migrations.schema_migrations - the same table the Supabase
# CLI uses, so `supabase db push` and this script agree on what is applied and
# you can switch between them.
#
# Safety properties:
#   * one transaction per migration file (nothing half-applies within a file);
#   * a transaction-scoped advisory lock, so two runs cannot interleave;
#   * the ledger insert happens inside the same transaction as the DDL, so
#     "applied" and "recorded" cannot disagree;
#   * the connection string is only ever read from the environment, never
#     printed, and no `set -x` is used.
#
# Usage:
#   SUPABASE_DB_URL='postgresql://...' ./scripts/apply-migrations.sh --status
#   SUPABASE_DB_URL='postgresql://...' ./scripts/apply-migrations.sh --dry-run
#   SUPABASE_DB_URL='postgresql://...' ./scripts/apply-migrations.sh --apply
#   SUPABASE_DB_URL='postgresql://...' ./scripts/apply-migrations.sh --baseline
#
# --baseline records every current file as applied WITHOUT running it. Use it
# once, when adopting this script against the database that was migrated by
# hand, after confirming the schema already matches.
#
# A migration that cannot run inside a transaction (CREATE INDEX CONCURRENTLY,
# ALTER TYPE ... ADD VALUE) must declare it on its own line:
#   -- migration: no-transaction

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
migrations_dir="${repo_root}/supabase/migrations"

# Arbitrary but fixed: "autoflex migrations" advisory lock key.
LOCK_KEY=4471625

mode="dry-run"
case "${1:-}" in
  --apply) mode="apply" ;;
  --dry-run|"") mode="dry-run" ;;
  --status) mode="status" ;;
  --baseline) mode="baseline" ;;
  -h|--help)
    sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unknown argument: ${1}. Expected --status, --dry-run, --apply or --baseline." >&2
    exit 2
    ;;
esac

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Export the Supabase connection string (session pooler or direct)." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install postgresql-client." >&2
  exit 2
fi

# -X ignores ~/.psqlrc, ON_ERROR_STOP turns any SQL error into a non-zero exit.
# `-X` ignores ~/.psqlrc so a developer's settings cannot change semantics.
# The connection string stays in the environment; it is never echoed. (On a
# shared host prefer discrete PGHOST/PGUSER/PGPASSWORD vars so the URL does not
# appear in `ps` output - on an ephemeral CI runner this is not a real risk.)
psql_run() {
  PGCONNECT_TIMEOUT=15 psql -X -q -v ON_ERROR_STOP=1 -P pager=off -d "${SUPABASE_DB_URL}" "$@"
}

psql_value() {
  PGCONNECT_TIMEOUT=15 psql -X -q -A -t -v ON_ERROR_STOP=1 -P pager=off -d "${SUPABASE_DB_URL}" -c "$1"
}

echo "==> Connecting to Supabase Postgres"
server_version="$(psql_value 'show server_version;')"
echo "    server_version: ${server_version}"

echo "==> Ensuring migration ledger exists"
psql_run <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

applied_file="$(mktemp)"
plan_file="$(mktemp)"
work_file="$(mktemp)"
trap 'rm -f "${applied_file}" "${plan_file}" "${work_file}"' EXIT

psql_value 'select version from supabase_migrations.schema_migrations order by version;' > "${applied_file}"

pending_count=0
applied_count=0
: > "${plan_file}"

shopt -s nullglob
for path in "${migrations_dir}"/*.sql; do
  file="$(basename "${path}")"
  version="${file%%_*}"
  if grep -qx -- "${version}" "${applied_file}"; then
    applied_count=$((applied_count + 1))
    continue
  fi
  pending_count=$((pending_count + 1))
  printf '%s\n' "${path}" >> "${plan_file}"
done
shopt -u nullglob

echo "==> Ledger: ${applied_count} applied, ${pending_count} pending"
if [ "${pending_count}" -gt 0 ]; then
  echo "    Pending, in order:"
  while IFS= read -r path; do
    echo "      - $(basename "${path}")"
  done < "${plan_file}"
fi

if [ "${mode}" = "status" ]; then
  exit 0
fi

if [ "${pending_count}" -eq 0 ]; then
  echo "==> Nothing to do."
  exit 0
fi

if [ "${mode}" = "dry-run" ]; then
  echo "==> Dry run: no statements were executed."
  echo "    Re-run with --apply (or the 'apply' mode in the migrate workflow) to execute them."
  exit 0
fi

# Read the plan on fd 3 so nothing inside the loop can swallow it from stdin.
while IFS= read -r path <&3; do
  file="$(basename "${path}")"
  version="${file%%_*}"
  # Strip the timestamp prefix and the .sql suffix for the ledger's name column.
  name="${file#*_}"
  name="${name%.sql}"

  if [ "${mode}" = "baseline" ]; then
    echo "==> Baselining ${file} (recorded, NOT executed)"
    psql_run -c "insert into supabase_migrations.schema_migrations (version, name, statements)
                 values ('${version}', '${name}', array['-- baselined by scripts/apply-migrations.sh'])
                 on conflict (version) do nothing;"
    continue
  fi

  transactional=1
  if grep -qiE '^[[:space:]]*--[[:space:]]*migration:[[:space:]]*no-transaction' "${path}"; then
    transactional=0
  fi

  echo "==> Applying ${file} (transactional=${transactional})"

  {
    if [ "${transactional}" -eq 1 ]; then
      # Transaction-scoped lock: released automatically on commit or rollback,
      # so a crashed run cannot leave the lock held.
      cat <<'GUARD'
do $autoflex_lock$
begin
  if not pg_try_advisory_xact_lock(4471625) then
    raise exception 'Another Autoflex migration run holds the lock; refusing to interleave.';
  end if;
end
$autoflex_lock$;
GUARD
    fi
    cat "${path}"
    printf '\n'
    # No ON CONFLICT: if a concurrent run recorded this version first, the
    # primary key violation aborts this transaction and rolls the DDL back.
    printf "insert into supabase_migrations.schema_migrations (version, name, statements) values ('%s', '%s', array['-- applied by scripts/apply-migrations.sh']);\n" \
      "${version}" "${name}"
  } > "${work_file}"

  if [ "${transactional}" -eq 1 ]; then
    psql_run --single-transaction -f "${work_file}"
  else
    echo "    NOTE: runs without a wrapping transaction (declared no-transaction)."
    echo "    If it fails midway, follow docs/RUNBOOK.md 'Migration half-applied'."
    psql_run -f "${work_file}"
  fi

  echo "    ok: ${file}"
done 3< "${plan_file}"

echo "==> Done. ${pending_count} migration(s) processed in ${mode} mode."
