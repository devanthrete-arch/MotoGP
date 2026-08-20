-- `public.sync_owner_post_comment_count()` is a trigger function and must stay
-- SECURITY DEFINER: a commenter has to increment `comment_count` on someone
-- else's post row, which the owner_posts UPDATE policy would otherwise block.
--
-- It should never have been callable as an RPC though. PostgREST exposes every
-- executable function in `public` at /rest/v1/rpc/<name>, so anon could invoke
-- it directly; the security advisor flags exactly this (lints 0028 and 0029).
--
-- Revoking EXECUTE does not break the trigger: PostgreSQL checks EXECUTE on a
-- trigger function when the trigger is CREATED, not each time it fires.
-- Verified empirically on this project against a throwaway schema before
-- applying here.
revoke all on function public.sync_owner_post_comment_count() from public;
revoke all on function public.sync_owner_post_comment_count() from anon;
revoke all on function public.sync_owner_post_comment_count() from authenticated;
