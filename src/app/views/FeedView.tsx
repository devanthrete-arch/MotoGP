// Community: the shared feed, its composer, and the selected note with its discussion.
import { isSharedPost } from "../../communityCloud";
import { PenLine, X } from "lucide-react";
import { knowledgeLabels, type KnowledgeLabel } from "../../domain";
import { buildModelReviewSummaries, modelKeyFor } from "../../insights";
import { Link } from "react-router";
import { type FeedMode, type PriceState, brands, postSource, priceStates, viewPaths } from "../model";
import { useOtofolks } from "../state";

export function FeedView() {
  const {
    auth, communityStatus, setCommunityStatus, communityBusy, setCommunityRefresh, profile, saved, query,
    setQuery, mode, setMode, selectedLabel, setSelectedLabel, selectedFeedState, setSelectedFeedState,
    selectedPost, setSelectedPost, composerOpen, setComposerOpen, draft, setDraft, commentDraft,
    setCommentDraft, reportDraft, setReportDraft, reportOpen, setReportOpen, myPostIds, helpfulIds, confirmedIds,
    isOnline, followedModelSet, followedTopicSet, filteredPosts, feedPosts, publishedPitStopClips,
    selectedPostQuality, toggleSaved, toggleFollowModel, toggleFollowTopic, markHelpful, confirmFix,
    addComment, reportSelectedPost, deleteSelectedSharedPost, shareSelectedPost, addSelectedToShortlist,
    publishPost,
  } = useOtofolks();
  const modelReviewSummaries = buildModelReviewSummaries(feedPosts);
  return (
    <section className="panel" id="feed">
      {communityStatus ? <p role="status">{communityStatus}</p> : null}
      {auth.cloudClient && isOnline ? <button className="save-button" type="button" onClick={() => {
        setCommunityStatus("Loading shared notes...");
        setCommunityRefresh(current => current + 1);
      }}>Refresh shared notes</button> : null}
      <div className="feed-composer">
        {!composerOpen ? (
          <button className="composer-prompt" type="button" onClick={() => setComposerOpen(true)}>
            <span className="composer-avatar" aria-hidden="true">
              {(profile.displayName.trim() || "O").charAt(0).toUpperCase()}
            </span>
            <span className="composer-placeholder">Share advice with the community…</span>
            <PenLine size={18} aria-hidden="true" />
          </button>
        ) : (
          <form className="composer composer-expanded" onSubmit={publishPost}>
            <div className="composer-expanded-head">
              <span className="composer-avatar" aria-hidden="true">
                {(profile.displayName.trim() || "O").charAt(0).toUpperCase()}
              </span>
              <strong>Post to the community</strong>
              <button className="composer-close" type="button" aria-label="Close composer" onClick={() => setComposerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <input
              value={draft.title}
              maxLength={160}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Title — e.g. Nexon clutch got heavy at 38k km"
              required
            />
            <textarea
              rows={3}
              maxLength={10000}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              placeholder="Share what happened, what you tried, and what helped…"
              required
            />
            <div className="form-row">
              <select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
                {knowledgeLabels.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
              <select value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                value={draft.model}
                onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                placeholder={draft.label === "Review" ? "Model" : "Model (optional)"}
                required={draft.label === "Review"}
              />
            </div>
            {draft.label === "Review" ? (
              <fieldset className="review-prompts">
                <legend>Help another owner understand life with this car</legend>
                <label>What has worked well?
                  <textarea rows={2} maxLength={2000} required value={draft.reviewPros ?? ""}
                    onChange={(event) => setDraft({ ...draft, reviewPros: event.target.value })}
                    placeholder="Comfort, reliability, service experience..." />
                </label>
                <label>What should a buyer know or watch for?
                  <textarea rows={2} maxLength={2000} required value={draft.reviewCons ?? ""}
                    onChange={(event) => setDraft({ ...draft, reviewCons: event.target.value })}
                    placeholder="Trade-offs, costs, things you would change..." />
                </label>
                <label>Would you choose it again?
                  <select required value={draft.reviewVerdict ?? ""} onChange={(event) => setDraft({
                    ...draft, reviewVerdict: event.target.value as typeof draft.reviewVerdict,
                  })}>
                    <option value="">Choose one</option>
                    <option value="buy-again">Yes</option>
                    <option value="unsure">Not sure</option>
                    <option value="not-again">No</option>
                  </select>
                </label>
              </fieldset>
            ) : null}
            <div className="composer-actions">
              <span className="form-note">Posting as {profile.displayName.trim() || "Anonymous owner"}</span>
              <button className="primary-action" disabled={communityBusy || !auth.cloudClient || !isOnline} type="submit">Post</button>
            </div>
          </form>
        )}
      </div>

      <div className="section-head">
        <div>
          <p className="eyebrow">Community feed</p>
          <h2>From one owner to another</h2>
          <Link className="primary-action" to={viewPaths.write}>Write an owner note</Link>
        </div>
        <div className="filters" aria-label="Feed filters">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brand, model, city, issue..."
            type="search"
          />
          <select value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value as KnowledgeLabel | "All")}>
            <option>All</option>
            {knowledgeLabels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
          <select value={selectedFeedState} onChange={(event) => setSelectedFeedState(event.target.value as PriceState | "All")}>
            <option value="All">All states</option>
            {priceStates.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
          <select value={mode} onChange={(event) => setMode(event.target.value as FeedMode)}>
            <option value="latest">Latest</option>
            <option value="helpful">Most helpful</option>
            <option value="following">Following</option>
            <option value="saved">Saved</option>
          </select>
          <button className="save-button" type="button" onClick={() => setMode("saved")}>
            Saved notes · {saved.size}
          </button>
        </div>
      </div>

      <div className="content-grid">
        <div className="feed-list">
          {filteredPosts.length ? (
            filteredPosts.map((post) => (
              <article
                className={`post-card ${selectedPost?.id === post.id ? "is-selected" : ""}`}
                key={post.id}
              >
                <div>
                  <span className="pill">{post.label}</span>
                  <span className="pill">{postSource(post.id)}</span>
                  <h3><button className="post-open" type="button" onClick={() => {
                    setSelectedPost(post);
                    requestAnimationFrame(() => document.getElementById("note-detail")?.focus());
                  }}>{post.title}</button></h3>
                  <p>
                    {post.brand} {post.model} · {post.city} · {post.odometerKm.toLocaleString("en-IN")} km
                  </p>
                </div>
                <button
                  className="save-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSaved(post.id);
                  }}
                >
                  {saved.has(post.id) ? "Saved note" : "Save note"}
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">No notes match this filter yet. Write or follow the first useful one.</div>
          )}
        </div>

        <aside className="detail-card" id="note-detail" tabIndex={-1} aria-label="Owner note">
          {selectedPost ? (
            <>
              <span className="pill">{selectedPost.label}</span>
              <span className="pill">{postSource(selectedPost.id)}</span>
              <h2>{selectedPost.title}</h2>
              <p className="owner-line">
                By {selectedPost.author} · {selectedPost.brand} {selectedPost.model} {selectedPost.variant} ·{" "}
                {selectedPost.city}
              </p>
              <p>{selectedPost.body}</p>
              {selectedPost.label === "Review" && (selectedPost.reviewPros || selectedPost.reviewCons || selectedPost.reviewVerdict) ? (
                <section className="owner-review-detail" aria-label="Structured owner review">
                  <h3>Owner’s experience</h3>
                  {selectedPost.reviewPros ? <p><strong>Worked well:</strong> {selectedPost.reviewPros}</p> : null}
                  {selectedPost.reviewCons ? <p><strong>Worth knowing:</strong> {selectedPost.reviewCons}</p> : null}
                  {selectedPost.reviewVerdict ? <p><strong>Choose it again:</strong> {{
                    "buy-again": "Yes", unsure: "Not sure", "not-again": "No",
                  }[selectedPost.reviewVerdict]}</p> : null}
                </section>
              ) : null}
              {selectedPostQuality ? (
                <div className={`quality-card ${selectedPostQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="quality-meter">
                    <span style={{ width: `${(selectedPostQuality.score / selectedPostQuality.maxScore) * 100}%` }} />
                  </div>
                  <strong>
                    {selectedPostQuality.grade} · {selectedPostQuality.score}/{selectedPostQuality.maxScore}
                  </strong>
                  <p>{selectedPostQuality.strengths[0] ?? "This note needs more ownership context."}</p>
                </div>
              ) : null}
              <div className="signal-row">
                <button disabled={isSharedPost(selectedPost.id)} type="button" aria-pressed={helpfulIds.includes(selectedPost.id)} onClick={() => markHelpful(selectedPost.id)}>
                  Helpful · {selectedPost.helpful}
                </button>
                {selectedPost.label === "Fix" ? (
                  <button disabled={isSharedPost(selectedPost.id)} type="button" aria-pressed={confirmedIds.includes(selectedPost.id)} onClick={() => confirmFix(selectedPost.id)}>
                    Worked for me · {selectedPost.fixesConfirmed}
                  </button>
                ) : null}
                <button type="button" onClick={() => toggleSaved(selectedPost.id)}>
                  {saved.has(selectedPost.id) ? "Remove saved" : "Save note"}
                </button>
                <button type="button" onClick={() => toggleFollowModel(selectedPost.brand, selectedPost.model)}>
                  {followedModelSet.has(modelKeyFor(selectedPost.brand, selectedPost.model)) ? "Following model" : "Follow model"}
                </button>
                <button type="button" onClick={() => toggleFollowTopic(selectedPost.label)}>
                  {followedTopicSet.has(selectedPost.label) ? "Following topic" : "Follow topic"}
                </button>
                <button type="button" onClick={shareSelectedPost}>
                  Share note
                </button>
                <button type="button" onClick={addSelectedToShortlist}>
                  Add model to compare
                </button>
                {myPostIds?.has(selectedPost.id) ? (
                  <button disabled={communityBusy || !isOnline} type="button" onClick={deleteSelectedSharedPost}>
                    Delete my note
                  </button>
                ) : null}
              </div>
              <div className="related-pitstop-strip" aria-label="Related Pit Stop clips">
                <strong>Watch alongside this review</strong>
                {publishedPitStopClips
                  .filter((clip) => clip.brand === selectedPost.brand || clip.model === selectedPost.model)
                  .slice(0, 2)
                  .map((clip) => (
                    <a href={clip.embedUrl} key={clip.id} rel="noreferrer" target="_blank">
                      {clip.title}
                    </a>
                  ))}
              </div>
              <div className="comments">
                <strong>Discussion</strong>
                {selectedPost.comments.map((comment) => (
                  <p key={comment}>{comment}</p>
                ))}
              </div>
              <form className="inline-form" onSubmit={addComment}>
                <textarea
                  required
                  rows={3}
                  maxLength={4000}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add a useful reply, correction, bill detail, or ownership question."
                />
                <button className="primary-action" disabled={communityBusy || !isOnline || !isSharedPost(selectedPost.id)} type="submit">
                  Add comment
                </button>
              </form>
              <details className="report-disclosure" open={reportOpen}
                onToggle={(event) => setReportOpen(event.currentTarget.open)}><summary>Report this note</summary>
              <form className="inline-form report-form" onSubmit={reportSelectedPost}>
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={reportDraft}
                  onChange={(event) => setReportDraft(event.target.value)}
                  placeholder="Tell us what is wrong with this note."
                />
                <button className="save-button" disabled={communityBusy} type="submit">
                  {isSharedPost(selectedPost.id) ? "Send report" : "Save report draft"}
                </button>
              </form>
              </details>
            </>
          ) : (
            <p>Select a post to inspect owner details.</p>
          )}
        </aside>
      </div>

      <section className="model-review-summaries" aria-labelledby="model-review-title">
        <div className="section-head"><div><p className="eyebrow">Owner experience</p><h2 id="model-review-title">What owners say by model</h2></div></div>
        {modelReviewSummaries.length ? (
          <div className="content-grid">
            {modelReviewSummaries.slice(0, 4).map((summary) => (
              <article className="detail-card" key={summary.key}>
                <h3>{summary.brand} {summary.model}</h3>
                <p className="form-note">{summary.evidence.length} structured owner review{summary.evidence.length === 1 ? "" : "s"}; each note reflects one owner’s experience.</p>
                {summary.evidence.map((review) => (
                  <div className="owner-review-summary" key={review.id}>
                    <strong>{review.title}</strong>
                    <p>{review.variant || "Variant not specified"} · {review.city || "Location not specified"} · {review.author}</p>
                    {review.reviewPros ? <p><strong>Worked well:</strong> {review.reviewPros}</p> : null}
                    {review.reviewCons ? <p><strong>Worth knowing:</strong> {review.reviewCons}</p> : null}
                    {review.reviewVerdict ? <p><strong>Choose it again:</strong> {{
                      "buy-again": "Yes", unsure: "Not sure", "not-again": "No",
                    }[review.reviewVerdict]}</p> : null}
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : <p className="empty-state">Structured model reviews will appear here as owners share them.</p>}
      </section>
    </section>
  );
}
