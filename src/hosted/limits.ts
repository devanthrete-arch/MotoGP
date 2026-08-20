/**
 * Row caps for list reads.
 *
 * Every list query must be bounded. An unbounded `select` makes payload and
 * client memory a function of database size rather than screen size — the exact
 * failure the community feed had before it was paginated.
 *
 * These caps are a safety net, not a paging mechanism: they stop a query from
 * ever becoming unbounded. Surfaces that genuinely need to walk a large table
 * should use a cursor (see `listHostedPostsPage`) rather than a bigger cap.
 */

/**
 * Anon-readable, globally shared tables (city circles, model playbooks,
 * playbook entries, post quality). These grow with the whole product, so the
 * cap is what a screen can plausibly render, not what exists.
 */
export const PUBLIC_LIST_LIMIT = 200;

/**
 * Owner-scoped tables, already narrowed by `user_id` under RLS. Bounded by one
 * person's own history, so the cap only guards against pathological accounts.
 */
export const OWNER_LIST_LIMIT = 1000;

/** Child rows belonging to a single parent (comments on a post, items in a session). */
export const CHILD_LIST_LIMIT = 500;
