import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const feedMigration = "202610070001_clerk_community_feed.sql";
const hardeningMigration = "202610080001_community_feed_hardening.sql";

const applyMigration = async (db: PGlite, name: string) =>
  db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));

async function createFeedDatabase(migrations: string[]): Promise<PGlite> {
  const db = new PGlite();
  // Supabase grants new public tables and functions to the client roles by default, so a
  // migration's own revokes are what keep them closed. Model that here.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    $$;
    grant execute on function auth.jwt() to anon, authenticated;
  `);
  for (const name of migrations) await applyMigration(db, name);
  return db;
}

const signInAs = (db: PGlite, subject: string) =>
  db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${subject}"}', false)`);

const insertPost = (db: PGlite, title = "Test note") => db.query(`
  insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body)
  values ($1, 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Useful detail')
`, [title]);

it("restricts shared posts to signed-in Clerk users and hides subjects", async () => {
  const db = await createFeedDatabase([feedMigration]);
  try {
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
    await signInAs(db, "legacy-uuid");
    await expect(insertPost(db)).rejects.toThrow();

    await signInAs(db, "user_test_a");
    await insertPost(db);
    const rows = (await db.query<{ id: string; title: string }>("select id, title from public.community_posts")).rows;
    expect(rows).toHaveLength(1);
    await db.query(`insert into public.community_comments (post_id, author, body)
      values ($1, 'Owner', 'Helpful reply')`, [rows[0].id]);
    expect((await db.query("select body from public.community_comments")).rows).toEqual([{ body: "Helpful reply" }]);
    await signInAs(db, "legacy-uuid");
    expect((await db.query("select title from public.community_posts")).rows).toEqual([]);
    expect((await db.query("select body from public.community_comments")).rows).toEqual([]);
    await expect(db.query("select author_subject from public.community_posts")).rejects.toThrow();
    await expect(db.query("update public.community_posts set title = 'Changed'")).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30_000);

it("stops members dating, padding or mislabelling what they publish", async () => {
  const db = await createFeedDatabase([feedMigration, hardeningMigration]);
  try {
    await db.exec("set role authenticated");
    await signInAs(db, "user_test_a");

    await expect(db.query(`
      insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body, "createdAt")
      values ('Pinned', 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Body', '2099-01-01')
    `)).rejects.toThrow(/permission denied/);
    await expect(db.query(`
      insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body, status)
      values ('Hidden', 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Body', 'hidden')
    `)).rejects.toThrow(/permission denied/);
    await expect(db.query(`
      insert into public.community_posts (id, title, author, brand, model, variant, city, "odometerKm", label, topic, body)
      values (gen_random_uuid(), 'Chosen id', 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Body')
    `)).rejects.toThrow(/permission denied/);

    await expect(insertPost(db, `a${" ".repeat(200)}`)).rejects.toThrow(/community_posts_title_raw_length/);
    await insertPost(db);
    const [post] = (await db.query<{ id: string; createdAt: Date }>(`select id, "createdAt" from public.community_posts`)).rows;
    expect(Math.abs(post.createdAt.getTime() - Date.now())).toBeLessThan(60_000);

    await expect(db.query(`insert into public.community_comments (post_id, author, body, created_at)
      values ($1, 'Owner', 'Reply', '2099-01-01')`, [post.id])).rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into public.community_comments (post_id, author, body)
      values ($1, 'Owner', $2)`, [post.id, `a${" ".repeat(4000)}`])).rejects.toThrow(/community_comments_body_raw_length/);
  } finally {
    await db.close();
  }
}, 30_000);

it("repairs rows that used the open grant, so they are neither pinned nor stuck", async () => {
  const db = await createFeedDatabase([feedMigration]);
  try {
    await db.exec("set role authenticated");
    await signInAs(db, "user_test_a");
    await db.query(`
      insert into public.community_posts (title, author, brand, model, variant, city, "odometerKm", label, topic, body, "createdAt")
      values ($1, 'Owner', 'Tata', 'Nexon', '', 'Pune', 100, 'Owner note', 'Service', 'Body', '2099-01-01')
    `, [`Spam${" ".repeat(5000)}`]);
    const [post] = (await db.query<{ id: string }>("select id from public.community_posts")).rows;
    await db.query(`insert into public.community_comments (post_id, author, body, created_at)
      values ($1, 'Owner', $2, '2099-01-01')`, [post.id, `Reply${" ".repeat(9000)}`]);

    await db.exec("reset role");
    await applyMigration(db, hardeningMigration);
    await db.exec(`insert into public.community_moderators (subject) values ('user_moderator')`);
    const [repaired] = (await db.query<{ title: string; createdAt: Date }>(
      `select title, "createdAt" from public.community_posts`)).rows;
    expect(repaired.title).toBe("Spam");
    expect(repaired.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const [comment] = (await db.query<{ body: string; created_at: Date }>(
      "select body, created_at from public.community_comments")).rows;
    expect(comment.body).toBe("Reply");
    expect(comment.created_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from pg_constraint
      where conname like 'community\\_%raw\\_length' and convalidated`)).rows).toEqual([{ n: 6 }]);

    await db.exec("set role authenticated");
    await signInAs(db, "user_moderator");
    await db.query("select public.moderate_community_post($1, 'hidden')", [post.id]);
    await signInAs(db, "user_test_a");
    expect((await db.query("select title from public.community_posts")).rows).toEqual([]);
  } finally {
    await db.close();
  }
}, 30_000);

it("lets only the author edit or delete a shared post", async () => {
  const db = await createFeedDatabase([feedMigration, hardeningMigration]);
  try {
    await db.exec("set role authenticated");
    await signInAs(db, "user_test_a");
    await insertPost(db, "Mine");
    const [post] = (await db.query<{ id: string }>("select id from public.community_posts")).rows;
    await db.query(`insert into public.community_comments (post_id, author, body) values ($1, 'Owner', 'Reply')`, [post.id]);
    expect((await db.query("select * from public.my_community_post_ids()")).rows).toEqual([{ my_community_post_ids: post.id }]);

    await signInAs(db, "user_test_b");
    expect((await db.query("select * from public.my_community_post_ids()")).rows).toEqual([]);
    expect((await db.query("update public.community_posts set title = 'Taken over' where id = $1", [post.id])).affectedRows).toBe(0);
    expect((await db.query("delete from public.community_posts where id = $1", [post.id])).affectedRows).toBe(0);
    expect((await db.query("delete from public.community_posts")).affectedRows).toBe(0);
    await expect(db.query("delete from public.community_comments where post_id = $1", [post.id]))
      .rejects.toThrow(/permission denied/);

    await signInAs(db, "user_test_a");
    expect((await db.query("update public.community_posts set title = 'Corrected' where id = $1", [post.id])).affectedRows).toBe(1);
    await expect(db.query(`update public.community_posts set "createdAt" = '2099-01-01' where id = $1`, [post.id]))
      .rejects.toThrow(/permission denied/);
    await expect(db.query("update public.community_posts set status = 'hidden' where id = $1", [post.id]))
      .rejects.toThrow(/permission denied/);
    await expect(db.query(`update public.community_posts set title = $2 where id = $1`, [post.id, "b".repeat(161)]))
      .rejects.toThrow();
    expect((await db.query("delete from public.community_posts where id = $1 returning id", [post.id])).rows).toEqual([{ id: post.id }]);
    expect((await db.query("select title from public.community_posts")).rows).toEqual([]);

    await db.exec("reset role");
    expect((await db.query("select count(*)::int as n from public.community_comments")).rows).toEqual([{ n: 0 }]);
  } finally {
    await db.close();
  }
}, 30_000);

it("sends reports to moderators, who alone can read them and hide a post", async () => {
  const db = await createFeedDatabase([feedMigration, hardeningMigration]);
  try {
    expect((await db.query(`
      select
        has_table_privilege('authenticated', 'public.community_reports', 'SELECT') as member_reads_reports,
        has_table_privilege('anon', 'public.community_reports', 'INSERT') as anon_reports,
        has_table_privilege('authenticated', 'public.community_moderators', 'SELECT') as member_reads_moderators,
        has_table_privilege('authenticated', 'public.community_moderators', 'INSERT') as member_adds_moderators,
        has_table_privilege('authenticated', 'public.community_moderators', 'TRUNCATE') as member_empties_moderators,
        has_table_privilege('anon', 'public.community_moderators', 'SELECT') as anon_reads_moderators,
        has_function_privilege('anon', 'public.list_community_reports(boolean)', 'EXECUTE') as anon_lists_reports,
        has_function_privilege('anon', 'public.moderate_community_post(uuid, text)', 'EXECUTE') as anon_moderates,
        has_function_privilege('anon', 'public.resolve_community_report(uuid, text)', 'EXECUTE') as anon_resolves,
        has_function_privilege('anon', 'public.is_community_moderator()', 'EXECUTE') as anon_checks_role,
        has_function_privilege('anon', 'public.my_community_post_ids()', 'EXECUTE') as anon_lists_own
    `)).rows).toEqual([{
      member_reads_reports: false, anon_reports: false, member_reads_moderators: false,
      member_adds_moderators: false, member_empties_moderators: false, anon_reads_moderators: false,
      anon_lists_reports: false, anon_moderates: false, anon_resolves: false, anon_checks_role: false,
      anon_lists_own: false,
    }]);
    await db.exec(`insert into public.community_moderators (subject) values ('user_moderator')`);

    await db.exec("set role authenticated");
    await signInAs(db, "user_test_a");
    await insertPost(db, "Reported note");
    const [post] = (await db.query<{ id: string }>("select id from public.community_posts")).rows;

    await signInAs(db, "user_test_b");
    await db.query(`insert into public.community_reports (post_id, reason) values ($1, 'Abusive language')`, [post.id]);
    await expect(db.query(`insert into public.community_reports (post_id, reason) values ($1, 'Again')`, [post.id]))
      .rejects.toThrow(/duplicate key/);
    await expect(db.query(`insert into public.community_reports (post_id, reason, status) values ($1, 'x', 'dismissed')`, [post.id]))
      .rejects.toThrow(/permission denied/);
    await expect(db.query(`insert into public.community_reports (post_id, reason) values ($1, '   ')`, [post.id]))
      .rejects.toThrow();
    await expect(db.query("select * from public.community_reports")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.list_community_reports()")).rejects.toThrow(/Moderator access/);
    await expect(db.query("select public.moderate_community_post($1, 'hidden')", [post.id])).rejects.toThrow(/Moderator access/);
    await expect(db.query("select public.resolve_community_report($1, 'dismissed')", [post.id])).rejects.toThrow(/Moderator access/);
    expect((await db.query<{ ok: boolean }>("select public.is_community_moderator() as ok")).rows).toEqual([{ ok: false }]);

    await signInAs(db, "user_moderator");
    const reports = (await db.query<{ report_id: string; post_title: string; report_reason: string; report_status: string }>(
      "select report_id, post_title, report_reason, report_status from public.list_community_reports()")).rows;
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ post_title: "Reported note", report_reason: "Abusive language", report_status: "open" });
    await expect(db.query("select public.moderate_community_post($1, 'deleted')", [post.id])).rejects.toThrow(/published or hidden/);
    await db.query("select public.moderate_community_post($1, 'hidden')", [post.id]);
    expect((await db.query("select report_status from public.list_community_reports()")).rows).toEqual([]);
    expect((await db.query("select report_status from public.list_community_reports(false)")).rows).toEqual([{ report_status: "actioned" }]);

    await signInAs(db, "user_test_b");
    expect((await db.query("select title from public.community_posts")).rows).toEqual([]);
    await expect(db.query(`insert into public.community_reports (post_id, reason) values ($1, 'Hidden now')`, [post.id]))
      .rejects.toThrow(/row-level security/);
    await signInAs(db, "user_test_a");
    expect((await db.query("select * from public.my_community_post_ids()")).rows).toEqual([]);
    expect((await db.query("update public.community_posts set title = 'Back again' where id = $1", [post.id])).affectedRows).toBe(0);
    expect((await db.query("delete from public.community_posts where id = $1", [post.id])).affectedRows).toBe(0);
    expect((await db.query("delete from public.community_posts")).affectedRows).toBe(0);

    await signInAs(db, "user_moderator");
    await db.query("select public.moderate_community_post($1, 'published')", [post.id]);
    await signInAs(db, "user_test_b");
    expect((await db.query("select title from public.community_posts")).rows).toEqual([{ title: "Reported note" }]);
    await db.query(`insert into public.community_reports (post_id, reason) values ($1, 'Edited into abuse')`, [post.id]);

    await signInAs(db, "user_moderator");
    const reopened = (await db.query<{ report_id: string; report_reason: string }>(
      "select report_id, report_reason from public.list_community_reports()")).rows;
    expect(reopened.map(row => row.report_reason)).toEqual(["Edited into abuse"]);
    await db.query("select public.resolve_community_report($1, 'dismissed')", [reopened[0].report_id]);
    expect((await db.query("select report_status from public.list_community_reports()")).rows).toEqual([]);
    expect((await db.query("select report_status from public.list_community_reports(false) order by report_status")).rows)
      .toEqual([{ report_status: "actioned" }, { report_status: "dismissed" }]);
  } finally {
    await db.close();
  }
}, 30_000);
