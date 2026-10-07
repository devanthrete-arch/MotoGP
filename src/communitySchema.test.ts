import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("restricts shared posts to signed-in Clerk users and hides subjects", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      grant usage on schema public, auth to anon, authenticated;
      create function auth.jwt() returns jsonb language sql stable as $$
        select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
      $$;
      grant execute on function auth.jwt() to anon, authenticated;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202610070001_clerk_community_feed.sql", import.meta.url), "utf8"));

    const permissions = (await db.query(`
      select
        has_column_privilege('anon', 'public.community_posts', 'title', 'SELECT') as anon_posts,
        has_column_privilege('authenticated', 'public.community_posts', 'title', 'SELECT') as member_posts,
        has_column_privilege('authenticated', 'public.community_posts', 'author_subject', 'SELECT') as member_subject,
        has_column_privilege('anon', 'public.community_comments', 'body', 'SELECT') as anon_comments,
        has_column_privilege('authenticated', 'public.community_comments', 'author_subject', 'SELECT') as comment_subject
    `)).rows;
    expect(permissions).toEqual([{
      anon_posts: false, member_posts: true, member_subject: false,
      anon_comments: false, comment_subject: false,
    }]);

    await db.exec("set role authenticated");
    await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"legacy-uuid"}', false)`);
    await expect(db.query(`
      insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body)
      values ('Test note', 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Useful detail')
    `)).rejects.toThrow();

    await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_test_a"}', false)`);
    await db.query(`
      insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body)
      values ('Test note', 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Useful detail')
    `);
    const rows = (await db.query<{ id: string; title: string }>("select id, title from public.community_posts")).rows;
    expect(rows).toHaveLength(1);
    await db.query(`insert into public.community_comments (post_id, author, body)
      values ($1, 'Owner', 'Helpful reply')`, [rows[0].id]);
    expect((await db.query("select body from public.community_comments")).rows).toEqual([{ body: "Helpful reply" }]);
    await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"legacy-uuid"}', false)`);
    expect((await db.query("select title from public.community_posts")).rows).toEqual([]);
    expect((await db.query("select body from public.community_comments")).rows).toEqual([]);
    await expect(db.query("select author_subject from public.community_posts")).rejects.toThrow();
    await expect(db.query("update public.community_posts set title = 'Changed'")).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30_000);
