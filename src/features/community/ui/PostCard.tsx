import { memo } from "react";
import { Link } from "react-router-dom";
import { Bookmark, CarFront, ChevronsUp, CircleUserRound, Flag, MessageSquare } from "lucide-react";
import type { OwnerPost } from "../../../core/entities";
import { Badge, DataText, EdgeGlow } from "../../../ui/primitives";

export type PostCardProps = {
  isSaved: boolean;
  isSelected: boolean;
  onHelpful: (postId: string) => void;
  onOpenDetail: (post: OwnerPost) => void;
  onSelect: (post: OwnerPost) => void;
  onToggleSave: (postId: string) => void;
  post: OwnerPost;
};

/**
 * One owner note in the feed.
 *
 * Extracted from `CommunityFeed` and memoised on purpose. The feed subscribes
 * to the whole app context, so it re-renders on every keystroke in the
 * composer, the comment box and the search field. Before this split each of
 * those keystrokes also re-rendered every card in the list, so the cost of
 * typing grew with the length of the feed.
 *
 * The card takes only primitives and stable callbacks, so `memo` can bail out:
 * the handlers come from `useCallback` in `appState`, and `isSelected` /
 * `isSaved` are booleans rather than the `selectedPost` object or the `saved`
 * Set, which change identity on every unrelated update.
 */
function PostCardComponent({
  isSaved,
  isSelected,
  onHelpful,
  onOpenDetail,
  onSelect,
  onToggleSave,
  post,
}: PostCardProps) {
  return (
      <article
        className={`relative overflow-hidden bg-surface-container border rounded-lg p-4 flex flex-col gap-3 transition-colors ${
          isSelected ? "border-primary/60" : "border-outline-variant"
        }`}
      >
        <EdgeGlow />
        {/* Author row */}
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-10 h-10 rounded-full bg-surface-variant edge-highlight flex items-center justify-center shrink-0">
            <CircleUserRound className="w-5 h-5 text-primary" />
          </span>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <span className="text-sm text-on-surface leading-tight truncate">{post.author}</span>
            <DataText className="text-on-surface-variant uppercase truncate">{post.city || "Community"} · {post.odometerKm.toLocaleString("en-IN")} km</DataText>
          </div>
          <Badge className="shrink-0">{post.label}</Badge>
        </div>
        {/* Vehicle context */}
        <div className="inline-flex items-center gap-1.5 bg-surface-container-highest/60 rounded px-2 py-1 self-start edge-highlight max-w-full">
          <CarFront aria-hidden="true" className="w-3.5 h-3.5 text-outline shrink-0" />
          <DataText className="text-on-surface-variant uppercase truncate">
            {post.brand} {post.model}
            {post.variant ? ` • ${post.variant}` : ""}
          </DataText>
          {/* Fuel is only shown when the author actually stated it. */}
          {post.fuel ? (
            <DataText className="text-on-surface-variant uppercase shrink-0 border-l border-outline-variant pl-1.5">
              Fuel: {post.fuel}
            </DataText>
          ) : null}
        </div>
        {/* Title + excerpt */}
        <Link
          aria-label={`Read owner note: ${post.title}`}
          className="no-underline flex flex-col gap-1.5 group"
          to={`/community/${encodeURIComponent(post.id)}`}
          onClick={() => onSelect(post)}
        >
          <h3 className="font-display text-lg sm:text-xl font-semibold leading-snug text-on-surface group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-sm text-on-surface-variant line-clamp-2">{post.body}</p>
        </Link>
        {/* Action row */}
        <div className="flex items-center justify-between border-t border-outline-variant/60 pt-2 mt-1">
          <div className="flex items-center gap-2">
            <button
              aria-label={`Mark helpful: ${post.title}`}
              className="flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 text-on-surface-variant hover:text-primary transition-colors"
              type="button"
              onClick={() => onHelpful(post.id)}
            >
              <ChevronsUp aria-hidden="true" className="w-5 h-5" />
              <DataText className="text-on-surface">{post.helpful}</DataText>
            </button>
            <button
              aria-label={`Open discussion: ${post.title}`}
              className="flex items-center gap-1.5 min-h-[44px] px-2 text-on-surface-variant hover:text-primary transition-colors"
              type="button"
              onClick={() => onOpenDetail(post)}
            >
              <MessageSquare aria-hidden="true" className="w-4 h-4" />
              <DataText>{post.comments.length}</DataText>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label={isSaved ? `Remove saved note: ${post.title}` : `Save note: ${post.title}`}
              aria-pressed={isSaved}
              className={`w-11 h-11 flex items-center justify-center rounded transition-colors ${
                isSaved ? "text-primary" : "text-on-surface-variant hover:text-primary"
              }`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSave(post.id);
              }}
            >
              <Bookmark aria-hidden="true" className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
            </button>
            <button
              aria-label={`Report note: ${post.title}`}
              className="w-11 h-11 flex items-center justify-center rounded text-on-surface-variant hover:text-error transition-colors"
              type="button"
              onClick={() => onOpenDetail(post)}
            >
              <Flag aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>
  );
}

export const PostCard = memo(PostCardComponent);
