import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  Camera,
  CarFront,
  ChevronsUp,
  CircleUserRound,
  Flag,
  MessageSquare,
  PencilLine,
  Search,
  Video,
} from "lucide-react";
import { useApp, type FeedMode } from "../appState";
import { knowledgeLabels, type KnowledgeLabel } from "../domain";
import { vehicleBrands } from "../vehicleCatalog";
import { Badge, Card, DataText, EdgeGlow, EmptyState, GhostButton, LabelCaps, PrimaryButton } from "../components/ui";
import { CarDetail } from "./CarDetail";

function Chip({ active, children, onClick, ariaLabel }: { active: boolean; children: ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`whitespace-nowrap px-4 py-3 min-h-[44px] rounded-full font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors ${
        active
          ? "bg-primary text-on-primary shadow-[0_0_12px_rgba(199,198,203,0.4)]"
          : "bg-surface-container text-on-surface-variant border border-outline-variant hover:text-on-surface"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const modeChips: Array<{ mode: FeedMode; label: string }> = [
  { mode: "following", label: "For You" },
  { mode: "latest", label: "Latest" },
  { mode: "helpful", label: "Trending" },
  { mode: "saved", label: "Saved" },
];

export function CommunityFeed() {
  const app = useApp();
  const {
    query,
    mode,
    selectedLabel,
    filteredPosts,
    selectedPost,
    saved,
    cityCircles,
    postDetailOpen,
    postComposerOpen,
    draft,
    draftQuality,
  } = app;

  const qualityPercent = draftQuality.maxScore ? Math.round((draftQuality.score / draftQuality.maxScore) * 100) : 0;

  return (
    <>
      <section aria-label="Community feed" className="flex flex-col gap-5 pb-24 lg:pb-8" id="feed">
        {/* Composer entry card */}
        {!postComposerOpen ? (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="w-10 h-10 rounded-full bg-surface-variant edge-highlight flex items-center justify-center shrink-0">
                <CircleUserRound className="w-5 h-5 text-primary" />
              </span>
              <button
                className="flex-1 text-left bg-surface-container-highest rounded-t border-b border-outline-variant hover:border-primary focus-visible:border-primary transition-colors px-3 py-3 min-h-[44px] text-sm text-on-surface-variant"
                type="button"
                onClick={app.openPostComposer}
              >
                Share something with the community…
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 sm:pl-[52px]">
              <div className="flex gap-1">
                <button aria-label="Write a review" className="w-11 h-11 flex items-center justify-center rounded text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={app.openPostComposer}>
                  <PencilLine aria-hidden="true" className="w-5 h-5" />
                </button>
                <button aria-label="Share a photo note" className="w-11 h-11 flex items-center justify-center rounded text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={app.openPostComposer}>
                  <Camera aria-hidden="true" className="w-5 h-5" />
                </button>
                <button aria-label="Share a video note" className="w-11 h-11 flex items-center justify-center rounded text-on-surface-variant hover:text-primary transition-colors" type="button" onClick={app.openPostComposer}>
                  <Video aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>
              <PrimaryButton className="min-h-[44px]" onClick={app.openPostComposer}>
                Transmit
              </PrimaryButton>
            </div>
          </Card>
        ) : null}

        {/* Search + filter chips */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
            <input
              aria-label="Search owner notes"
              className="w-full min-h-[44px] !bg-surface-container-high !border-outline-variant !rounded !py-3 !pl-10 !pr-3 font-mono !text-xs tracking-[0.05em] text-on-surface placeholder:text-outline focus:!border-primary"
              placeholder="SEARCH BRAND, MODEL, CITY, ISSUE…"
              ref={app.communitySearchRef}
              type="search"
              value={query}
              onChange={(event) => app.setQuery(event.target.value)}
            />
          </div>
          <div aria-label="Owner note filters" className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
            {modeChips.map((chip) => (
              <Chip
                active={mode === chip.mode}
                ariaLabel={`Sort owner notes: ${chip.label}`}
                key={chip.mode}
                onClick={() => app.setMode(chip.mode)}
              >
                {chip.label}
              </Chip>
            ))}
            <span aria-hidden="true" className="w-px h-6 bg-outline-variant shrink-0 mx-1" />
            <Chip active={selectedLabel === "All"} ariaLabel="Show all note types" onClick={() => app.setSelectedLabel("All")}>
              All
            </Chip>
            {knowledgeLabels.map((label) => (
              <Chip
                active={selectedLabel === label}
                ariaLabel={`Filter notes by type: ${label}`}
                key={label}
                onClick={() => app.setSelectedLabel(label as KnowledgeLabel)}
              >
                {label === "Review" ? "Reviews" : label}
              </Chip>
            ))}
          </div>
        </div>

        {/* City circles */}
        {cityCircles.length ? (
          <div aria-label="Filter notes by city" className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
            <LabelCaps className="text-outline shrink-0">City circles</LabelCaps>
            {cityCircles.map((circle) => (
              <button
                aria-label={`Show notes from ${circle.city}`}
                aria-pressed={query === circle.city}
                className={`whitespace-nowrap min-h-[44px] px-3 py-2 rounded border font-mono text-xs tracking-[0.1em] transition-colors ${
                  query === circle.city
                    ? "border-primary text-primary bg-primary-container"
                    : "border-outline-variant text-on-surface-variant hover:text-on-surface bg-surface-container-lowest"
                }`}
                key={circle.city}
                type="button"
                onClick={() => app.setQuery(query === circle.city ? "" : circle.city)}
              >
                {circle.city} · {circle.posts.length}
              </button>
            ))}
          </div>
        ) : null}

        {/* Feed + detail */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start">
          <div className={`${postDetailOpen ? "hidden lg:flex" : "flex"} flex-col gap-4 min-w-0`}>
            {filteredPosts.length ? (
              filteredPosts.map((post) => (
                <article
                  className={`relative overflow-hidden bg-surface-container border rounded-lg p-4 flex flex-col gap-3 transition-colors ${
                    selectedPost?.id === post.id ? "border-primary/60" : "border-outline-variant"
                  }`}
                  key={post.id}
                >
                  <EdgeGlow />
                  {/* Author row */}
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="w-10 h-10 rounded-full bg-surface-variant edge-highlight flex items-center justify-center shrink-0">
                      <CircleUserRound className="w-5 h-5 text-primary" />
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <span className="text-sm text-on-surface leading-tight truncate">{post.author}</span>
                      <DataText className="text-outline uppercase truncate">{post.city || "Community"} · {post.odometerKm.toLocaleString("en-IN")} km</DataText>
                    </div>
                    <Badge className="shrink-0">{post.label}</Badge>
                  </div>
                  {/* Vehicle context */}
                  <div className="inline-flex items-center gap-1.5 bg-surface-container-highest/60 rounded px-2 py-1 self-start edge-highlight max-w-full">
                    <CarFront aria-hidden="true" className="w-3.5 h-3.5 text-outline shrink-0" />
                    <DataText className="text-outline uppercase truncate">
                      {post.brand} {post.model}
                      {post.variant ? ` ${post.variant}` : ""}
                    </DataText>
                  </div>
                  {/* Title + excerpt */}
                  <Link
                    aria-label={`Read owner note: ${post.title}`}
                    className="no-underline flex flex-col gap-1.5 group"
                    to={`/community/${encodeURIComponent(post.id)}`}
                    onClick={() => app.setSelectedPost(post)}
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
                        onClick={() => app.markHelpful(post.id)}
                      >
                        <ChevronsUp aria-hidden="true" className="w-5 h-5" />
                        <DataText className="text-on-surface">{post.helpful}</DataText>
                      </button>
                      <button
                        aria-label={`Open discussion: ${post.title}`}
                        className="flex items-center gap-1.5 min-h-[44px] px-2 text-on-surface-variant hover:text-primary transition-colors"
                        type="button"
                        onClick={() => app.openPostDetail(post)}
                      >
                        <MessageSquare aria-hidden="true" className="w-4 h-4" />
                        <DataText>{post.comments.length}</DataText>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={saved.has(post.id) ? `Remove saved note: ${post.title}` : `Save note: ${post.title}`}
                        aria-pressed={saved.has(post.id)}
                        className={`w-11 h-11 flex items-center justify-center rounded transition-colors ${
                          saved.has(post.id) ? "text-primary" : "text-on-surface-variant hover:text-primary"
                        }`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          app.toggleSaved(post.id);
                        }}
                      >
                        <Bookmark aria-hidden="true" className={`w-4 h-4 ${saved.has(post.id) ? "fill-current" : ""}`} />
                      </button>
                      <button
                        aria-label={`Report note: ${post.title}`}
                        className="w-11 h-11 flex items-center justify-center rounded text-on-surface-variant hover:text-error transition-colors"
                        type="button"
                        onClick={() => app.openPostDetail(post)}
                      >
                        <Flag aria-hidden="true" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState>
                <p>No notes match these filters.</p>
                <GhostButton
                  className="min-h-[44px]"
                  onClick={() => {
                    app.setQuery("");
                    app.setSelectedLabel("All");
                    app.setMode("latest");
                  }}
                >
                  Show all notes
                </GhostButton>
              </EmptyState>
            )}
          </div>

          <CarDetail />
        </div>
      </section>

      {postComposerOpen ? (
        <section aria-label="Write an owner note" className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start pb-24 lg:pb-8 mt-2" id="write">
          <div className="flex flex-col gap-4">
            <div>
              <LabelCaps className="text-primary block mb-1">Publish</LabelCaps>
              <h2 className="font-display text-2xl font-semibold uppercase tracking-tight text-on-surface">
                Share what another owner should know.
              </h2>
              <p className="text-sm text-on-surface-variant mt-2">
                Include the exact car, city, mileage, symptoms, costs, and outcome so others can judge whether your note
                applies to them.
              </p>
            </div>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <LabelCaps className="text-primary">Detail meter</LabelCaps>
                <DataText className="text-on-surface">
                  {draftQuality.score}/{draftQuality.maxScore}
                </DataText>
              </div>
              <progress
                aria-label={`Draft detail quality ${draftQuality.score} of ${draftQuality.maxScore}`}
                className="w-full h-1 appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-container-highest [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                max={draftQuality.maxScore}
                value={draftQuality.score}
              />
              <DataText className={qualityPercent >= 80 ? "text-primary" : "text-on-surface-variant"}>
                GRADE: {draftQuality.grade.toUpperCase()}
              </DataText>
              <div className="flex flex-col gap-1.5">
                {(draftQuality.missingPrompts.length ? draftQuality.missingPrompts : draftQuality.strengths)
                  .slice(0, 3)
                  .map((prompt) => (
                    <p className="text-xs text-on-surface-variant" key={prompt}>
                      {prompt}
                    </p>
                  ))}
              </div>
            </Card>
            <GhostButton className="self-start min-h-[44px]" onClick={app.returnToCommunityFeed}>
              Back to owner notes
            </GhostButton>
          </div>

          <form className="relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg p-4 sm:p-5 flex flex-col gap-3" onSubmit={app.publishPost}>
            <EdgeGlow />
            <input
              aria-label="Post title"
              autoFocus={postComposerOpen}
              className="w-full min-h-[44px]"
              placeholder="Title"
              ref={app.postTitleRef}
              required
              value={draft.title}
              onChange={(event) => app.setDraft({ ...draft, title: event.target.value })}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                aria-label="Garage name"
                className="w-full min-h-[44px]"
                placeholder="Your garage name"
                value={draft.author}
                onChange={(event) => app.setDraft({ ...draft, author: event.target.value })}
              />
              <select
                aria-label="Note type"
                className="w-full min-h-[44px]"
                value={draft.label}
                onChange={(event) => app.setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}
              >
                {knowledgeLabels.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                aria-label="Car brand"
                className="w-full min-h-[44px]"
                value={draft.brand}
                onChange={(event) => app.setDraft({ ...draft, brand: event.target.value })}
              >
                {vehicleBrands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                className="w-full min-h-[44px]"
                placeholder="Model"
                required
                value={draft.model}
                onChange={(event) => app.setDraft({ ...draft, model: event.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="w-full min-h-[44px]"
                placeholder="Variant"
                value={draft.variant}
                onChange={(event) => app.setDraft({ ...draft, variant: event.target.value })}
              />
              <input
                className="w-full min-h-[44px]"
                placeholder="City"
                value={draft.city}
                onChange={(event) => app.setDraft({ ...draft, city: event.target.value })}
              />
            </div>
            <input
              aria-label="Odometer in kilometres"
              className="w-full min-h-[44px]"
              min="0"
              placeholder="Odometer km"
              type="number"
              value={draft.odometerKm || ""}
              onChange={(event) => app.setDraft({ ...draft, odometerKm: Number(event.target.value) })}
            />
            <textarea
              aria-label="Owner note details"
              className="w-full"
              placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
              required
              rows={7}
              value={draft.body}
              onChange={(event) => app.setDraft({ ...draft, body: event.target.value })}
            />
            <PrimaryButton className="self-start min-h-[44px]" type="submit">
              Publish note
            </PrimaryButton>
          </form>
        </section>
      ) : null}
    </>
  );
}
