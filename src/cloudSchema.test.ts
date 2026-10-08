import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("enforces private workspace isolation, CAS, grants and validation in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create function auth.jwt() returns jsonb language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
      $$;
      revoke all on function auth.jwt() from public;
      grant execute on function auth.jwt() to anon, authenticated, service_role;
      -- Model permissive Supabase defaults so explicit revocations are exercised.
      alter default privileges in schema public
        grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public
        grant execute on functions to anon, authenticated, service_role;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202610050001_clerk_private_workspace.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202610080002_vehicle_model_v2.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/tests/private_workspace.sql", import.meta.url), "utf8"));

    expect((await db.query("select * from public.otofolks_private_workspaces")).rows).toEqual([]);
    const { rows } = await db.query(`
      select p.proretset, p.prosecdef, p.proconfig,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
        has_table_privilege('service_role', 'public.otofolks_private_workspaces', 'INSERT') as service_insert
      from pg_proc p
      where p.oid = 'public.save_otofolks_private_workspace(jsonb,bigint)'::regprocedure
    `);
    expect(rows).toEqual([{
      proretset: true, prosecdef: true, proconfig: ['search_path=""'],
      anon_execute: false, authenticated_execute: true, service_execute: false, service_insert: false,
    }]);
  } finally {
    await db.close();
  }
}, 30_000);
