import { FormEvent, useMemo, useState } from "react";
import {
  buildLoop,
  knowledgeLabels,
  timelineKinds,
  type DraftPost,
  type DraftTimelineEntry,
  type DraftVehicle,
  type FeedbackNote,
  type FollowState,
  type GarageVehicle,
  type KnowledgeLabel,
  type ModelNotebook,
  type OwnerPost,
  type TimelineEntry,
  type TimelineEntryKind,
} from "./domain";
import {
  addFeedback,
  createPost,
  createTimelineEntry,
  createVehicle,
  loadFeedback,
  loadFollows,
  loadGarage,
  loadPosts,
  loadSaved,
  loadTimeline,
  saveFollows,
  saveGarage,
  savePosts,
  saveSaved,
  saveTimeline,
} from "./storage";

type FeedMode = "latest" | "helpful" | "saved" | "following";

const brands = ["Tata", "Honda", "Kia", "Mahindra", "Maruti Suzuki", "Hyundai", "Toyota", "Skoda", "Volkswagen"];

const initialDraft: DraftPost = {
  title: "",
  author: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  label: "Owner note",
  topic: "Ownership review",
  body: "",
};

const initialVehicleDraft: DraftVehicle = {
  nickname: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  purchaseMonth: "",
};

const initialTimelineDraft: DraftTimelineEntry = {
  vehicleId: "",
  kind: "Service",
  title: "",
  amount: 0,
  odometerKm: 0,
  happenedOn: new Date().toISOString().slice(0, 10),
  note: "",
};

export function App() {
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved());
  const [follows, setFollows] = useState<FollowState>(() => loadFollows());
  const [garage, setGarage] = useState<GarageVehicle[]>(() => loadGarage());
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => loadTimeline());
  const [feedback, setFeedback] = useState<FeedbackNote[]>(() => loadFeedback());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FeedMode>("latest");
  const [selectedLabel, setSelectedLabel] = useState<KnowledgeLabel | "All">("All");
  const [selectedPost, setSelectedPost] = useState<OwnerPost | null>(posts[0] ?? null);
  const [draft, setDraft] = useState<DraftPost>(initialDraft);
  const [vehicleDraft, setVehicleDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [timelineDraft, setTimelineDraft] = useState<DraftTimelineEntry>(() => ({
    ...initialTimelineDraft,
    vehicleId: loadGarage()[0]?.id ?? "",
  }));
  const [feedbackDraft, setFeedbackDraft] = useState("");

  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = posts.filter((post) => {
      const modelKey = modelKeyFor(post.brand, post.model);
      const matchesSaved = mode !== "saved" || saved.has(post.id);
      const matchesFollowing = mode !== "following" || followedModelSet.has(modelKey) || followedTopicSet.has(post.label);
      const matchesLabel = selectedLabel === "All" || post.label === selectedLabel;
      const haystack = `${post.title} ${post.brand} ${post.model} ${post.variant} ${post.city} ${post.body}`.toLowerCase();
      return matchesSaved && matchesFollowing && matchesLabel && (!normalizedQuery || haystack.includes(normalizedQuery));
    });

    return [...visible].sort((first, second) => {
      if (mode === "helpful") return second.helpful - first.helpful;
      return Date.parse(second.createdAt) - Date.parse(first.createdAt);
    });
  }, [followedModelSet, followedTopicSet, mode, posts, query, saved, selectedLabel]);

  const returnNudges = useMemo(() => {
    const followedPosts = posts.filter(
      (post) => followedModelSet.has(modelKeyFor(post.brand, post.model)) || followedTopicSet.has(post.label),
    );
    const latestFollowed = followedPosts[0];
    const serviceSoon = garage.find((vehicle) => vehicle.odometerKm > 0 && vehicle.odometerKm % 10000 >= 8500);

    return [
      latestFollowed ? `New ${latestFollowed.label.toLowerCase()} surfaced for ${latestFollowed.brand} ${latestFollowed.model}.` : null,
      saved.size ? `${saved.size} saved note${saved.size === 1 ? "" : "s"} waiting in your garage shelf.` : null,
      serviceSoon ? `${serviceSoon.nickname || serviceSoon.model} is close to the next 10k km service checkpoint.` : null,
    ].filter((nudge): nudge is string => Boolean(nudge));
  }, [followedModelSet, followedTopicSet, garage, posts, saved.size]);

  const stats = useMemo(
    () => ({
      posts: posts.length,
      models: notebooks.length,
      fixes: posts.filter((post) => post.label === "Fix").length,
      confirmations: posts.reduce((total, post) => total + post.fixesConfirmed, 0),
      follows: follows.models.length + follows.topics.length,
      garage: garage.length,
    }),
    [follows.models.length, follows.topics.length, garage.length, notebooks.length, posts],
  );

  const persistPosts = (nextPosts: OwnerPost[]) => {
    setPosts(nextPosts);
    savePosts(nextPosts);
  };

  const persistFollows = (nextFollows: FollowState) => {
    setFollows(nextFollows);
    saveFollows(nextFollows);
  };

  const persistGarage = (nextGarage: GarageVehicle[]) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const persistTimeline = (nextTimeline: TimelineEntry[]) => {
    setTimeline(nextTimeline);
    saveTimeline(nextTimeline);
  };

  const toggleSaved = (postId: string) => {
    const next = new Set(saved);
    if (next.has(postId)) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
  };

  const toggleFollowModel = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const nextModels = follows.models.includes(key) ? follows.models.filter((item) => item !== key) : [...follows.models, key];
    persistFollows({ ...follows, models: nextModels });
  };

  const toggleFollowTopic = (topic: KnowledgeLabel) => {
    const nextTopics = follows.topics.includes(topic)
      ? follows.topics.filter((item) => item !== topic)
      : [...follows.topics, topic];
    persistFollows({ ...follows, topics: nextTopics });
  };

  const markHelpful = (postId: string) => {
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: post.helpful + 1 } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const confirmFix = (postId: string) => {
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: post.fixesConfirmed + 1, helpful: post.helpful + 1 } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const post = createPost({
      ...draft,
      author: draft.author.trim() || "Anonymous owner",
      odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
    });
    const next = [post, ...posts];
    persistPosts(next);
    setSelectedPost(post);
    setDraft(initialDraft);
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage]);
    setVehicleDraft(initialVehicleDraft);
  };

  const addTimelineNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timelineDraft.vehicleId) return;
    const entry = createTimelineEntry({
      ...timelineDraft,
      amount: Number.isFinite(timelineDraft.amount) ? timelineDraft.amount : 0,
      odometerKm: Number.isFinite(timelineDraft.odometerKm) ? timelineDraft.odometerKm : 0,
    });
    persistTimeline([entry, ...timeline]);
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
  };

  const submitFeedback = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedbackDraft.trim()) return;
    setFeedback(addFeedback(feedbackDraft.trim()));
    setFeedbackDraft("");
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Autoflex home">
            Auto<span>flex</span>
          </a>
          <div className="nav-actions">
            <a href="#feed">Feed</a>
            <a href="#garage">Garage</a>
            <a href="#notebooks">Model notebooks</a>
            <a href="#loop">Build loop</a>
          </div>
        </nav>

        <div className="hero-grid" id="top">
          <div>
            <p className="eyebrow">Team-BHP spirit, built for the next wave</p>
            <h1>Owner notes that help people buy, fix, and actually live with cars.</h1>
            <p className="hero-copy">
              Autoflex is a TypeScript web MVP for deep Indian auto discussions: real reviews, known issues, verified
              fixes, cost notes, travelogues, garage timelines, and model notebooks. Less noise, more garage truth.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#write">
                Write ownership note
              </a>
              <a className="secondary-action" href="#garage">
                Build my garage
              </a>
            </div>
          </div>

          <div className="instrument-card" aria-label="Autoflex MVP status">
            <div className="dial">
              <span>{stats.posts}</span>
              <small>owner notes</small>
            </div>
            <div className="instrument-row">
              <span>{stats.models} model notebooks</span>
              <strong>{stats.confirmations} fix confirmations</strong>
            </div>
            <div className="instrument-track">
              <span style={{ width: `${Math.min(100, (stats.fixes + stats.follows + stats.garage) * 12)}%` }} />
            </div>
            <p>Current build is web-first TypeScript. Kotlin/Android remains a later conversion path.</p>
          </div>
        </div>
      </section>

      <section className="service-boundary">
        <strong>Service-center integration boundary</strong>
        <span>
          Endpoints stay separate for now because another team owns that contract. This web MVP focuses on community,
          ownership knowledge, garage retention, moderation, and return-user loops.
        </span>
      </section>

      <section className="panel dashboard-panel" aria-label="Return user dashboard">
        <div>
          <p className="eyebrow">Return-user garage</p>
          <h2>Your next useful reason to come back.</h2>
        </div>
        <div className="nudge-grid">
          {returnNudges.length ? (
            returnNudges.map((nudge) => <p key={nudge}>{nudge}</p>)
          ) : (
            <p>Follow a model, save a note, or add a vehicle to unlock a more personal garage dashboard.</p>
          )}
        </div>
      </section>

      <section className="panel" id="feed">
        <div className="section-head">
          <div>
            <p className="eyebrow">Community feed</p>
            <h2>Useful posts first, drama last.</h2>
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
            <select value={mode} onChange={(event) => setMode(event.target.value as FeedMode)}>
              <option value="latest">Latest</option>
              <option value="helpful">Most helpful</option>
              <option value="following">Following</option>
              <option value="saved">Saved</option>
            </select>
          </div>
        </div>

        <div className="content-grid">
          <div className="feed-list">
            {filteredPosts.length ? (
              filteredPosts.map((post) => (
                <article
                  className={`post-card ${selectedPost?.id === post.id ? "is-selected" : ""}`}
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                >
                  <div>
                    <span className="pill">{post.label}</span>
                    <h3>{post.title}</h3>
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
                    {saved.has(post.id) ? "Saved" : "Save"}
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">No notes match this filter yet. Write or follow the first useful one.</div>
            )}
          </div>

          <aside className="detail-card">
            {selectedPost ? (
              <>
                <span className="pill">{selectedPost.label}</span>
                <h2>{selectedPost.title}</h2>
                <p className="owner-line">
                  By {selectedPost.author} · {selectedPost.brand} {selectedPost.model} {selectedPost.variant} ·{" "}
                  {selectedPost.city}
                </p>
                <p>{selectedPost.body}</p>
                <div className="signal-row">
                  <button type="button" onClick={() => markHelpful(selectedPost.id)}>
                    Helpful · {selectedPost.helpful}
                  </button>
                  {selectedPost.label === "Fix" ? (
                    <button type="button" onClick={() => confirmFix(selectedPost.id)}>
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
                </div>
                <div className="comments">
                  <strong>Discussion starters</strong>
                  {selectedPost.comments.map((comment) => (
                    <p key={comment}>{comment}</p>
                  ))}
                </div>
              </>
            ) : (
              <p>Select a post to inspect owner details.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="panel split-panel" id="write">
        <div>
          <p className="eyebrow">Publish</p>
          <h2>Write like the next owner depends on it.</h2>
          <p>
            The form pushes users toward context Team-BHP made valuable at its peak: variant, city, odometer, real
            symptoms, costs, and outcomes.
          </p>
        </div>
        <form className="composer" onSubmit={publishPost}>
          <input
            required
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Title"
          />
          <div className="form-row">
            <input
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
              placeholder="Your garage name"
            />
            <select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <input
              required
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              placeholder="Model"
            />
          </div>
          <div className="form-row">
            <input
              value={draft.variant}
              onChange={(event) => setDraft({ ...draft, variant: event.target.value })}
              placeholder="Variant"
            />
            <input
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
              placeholder="City"
            />
          </div>
          <input
            min="0"
            type="number"
            value={draft.odometerKm || ""}
            onChange={(event) => setDraft({ ...draft, odometerKm: Number(event.target.value) })}
            placeholder="Odometer km"
          />
          <textarea
            required
            rows={7}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
          />
          <button className="primary-action" type="submit">
            Publish note
          </button>
        </form>
      </section>

      <section className="panel" id="garage">
        <div className="section-head">
          <div>
            <p className="eyebrow">Garage timeline</p>
            <h2>Make ownership useful before something breaks.</h2>
          </div>
        </div>
        <div className="garage-grid">
          <form className="composer" onSubmit={addVehicle}>
            <h3>Add vehicle</h3>
            <input
              value={vehicleDraft.nickname}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
              placeholder="Nickname"
            />
            <div className="form-row">
              <select value={vehicleDraft.brand} onChange={(event) => setVehicleDraft({ ...vehicleDraft, brand: event.target.value })}>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                required
                value={vehicleDraft.model}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
                placeholder="Model"
              />
            </div>
            <div className="form-row">
              <input
                value={vehicleDraft.variant}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, variant: event.target.value })}
                placeholder="Variant"
              />
              <input
                value={vehicleDraft.city}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, city: event.target.value })}
                placeholder="City"
              />
            </div>
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={vehicleDraft.odometerKm || ""}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, odometerKm: Number(event.target.value) })}
                placeholder="Current odometer"
              />
              <input
                type="month"
                value={vehicleDraft.purchaseMonth}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, purchaseMonth: event.target.value })}
                aria-label="Purchase month"
              />
            </div>
            <button className="primary-action" type="submit">
              Save vehicle
            </button>
          </form>

          <form className="composer" onSubmit={addTimelineNote}>
            <h3>Add timeline note</h3>
            <select
              required
              value={timelineDraft.vehicleId}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })}
            >
              {garage.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname || vehicle.model}
                </option>
              ))}
            </select>
            <div className="form-row">
              <select
                value={timelineDraft.kind}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })}
              >
                {timelineKinds.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <input
                type="date"
                value={timelineDraft.happenedOn}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })}
                aria-label="Timeline date"
              />
            </div>
            <input
              required
              value={timelineDraft.title}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, title: event.target.value })}
              placeholder="What happened?"
            />
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={timelineDraft.amount || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
                placeholder="Amount paid"
              />
              <input
                min="0"
                type="number"
                value={timelineDraft.odometerKm || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
                placeholder="Odometer"
              />
            </div>
            <textarea
              rows={4}
              value={timelineDraft.note}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, note: event.target.value })}
              placeholder="Bill details, symptoms, shop notes, or what you would do differently."
            />
            <button className="primary-action" type="submit">
              Add timeline note
            </button>
          </form>
        </div>

        <div className="timeline-board">
          {garage.map((vehicle) => (
            <article className="vehicle-card" key={vehicle.id}>
              <span className="pill">{vehicle.brand}</span>
              <h3>{vehicle.nickname}</h3>
              <p>
                {vehicle.model} {vehicle.variant} · {vehicle.city} · {vehicle.odometerKm.toLocaleString("en-IN")} km
              </p>
              {timeline
                .filter((entry) => entry.vehicleId === vehicle.id)
                .slice(0, 3)
                .map((entry) => (
                  <div className="timeline-entry" key={entry.id}>
                    <strong>
                      {entry.kind}: {entry.title}
                    </strong>
                    <span>
                      {formatMoney(entry.amount)} · {entry.odometerKm.toLocaleString("en-IN")} km · {entry.happenedOn}
                    </span>
                    <p>{entry.note}</p>
                  </div>
                ))}
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="notebooks">
        <div className="section-head">
          <div>
            <p className="eyebrow">Model notebooks</p>
            <h2>Every model earns its own living knowledge page.</h2>
          </div>
        </div>
        <div className="notebook-grid">
          {notebooks.map((notebook) => {
            const isFollowing = followedModelSet.has(notebook.key);
            return (
              <article className="notebook-card" key={notebook.key}>
                <span className="pill">{notebook.brand}</span>
                <h3>{notebook.model}</h3>
                <p>{notebook.posts.length} owner notes</p>
                <button className="save-button" type="button" onClick={() => toggleFollowModel(notebook.brand, notebook.model)}>
                  {isFollowing ? "Following" : "Follow model"}
                </button>
                <div className="notebook-tags">
                  {knowledgeLabels
                    .filter((label) => notebook.posts.some((post) => post.label === label))
                    .map((label) => (
                      <button key={label} type="button" onClick={() => toggleFollowTopic(label)}>
                        {followedTopicSet.has(label) ? `Following ${label}` : label}
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel" id="loop">
        <div className="section-head">
          <div>
            <p className="eyebrow">Build loop</p>
            <h2>The product keeps moving through six lenses.</h2>
          </div>
        </div>
        <div className="loop-grid">
          {buildLoop.map((item) => (
            <article className="loop-card" key={item.role}>
              <span>{item.role}</span>
              <h3>{item.question}</h3>
              <p>{item.currentDecision}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel qa-panel">
        <div>
          <p className="eyebrow">Tested / QA</p>
          <h2>Smoke checks for this slice.</h2>
        </div>
        <div className="qa-grid">
          <p>Feed supports latest, helpful, saved, and following modes.</p>
          <p>Followed models/topics create return-user nudges.</p>
          <p>Garage vehicles and timeline entries persist locally.</p>
          <p>Service-center integration remains outside this MVP loop.</p>
        </div>
      </section>

      <section className="panel split-panel">
        <div>
          <p className="eyebrow">Real user perspective</p>
          <h2>Capture what testers trip over.</h2>
          <p>
            This local feedback lane is the first version of the product-owner inbox. It keeps the MVP loop honest
            until a hosted backend is wired.
          </p>
          <div className="feedback-list">
            {feedback.slice(0, 3).map((note) => (
              <p key={note.id}>{note.message}</p>
            ))}
          </div>
        </div>
        <form className="composer" onSubmit={submitFeedback}>
          <textarea
            required
            rows={6}
            value={feedbackDraft}
            onChange={(event) => setFeedbackDraft(event.target.value)}
            placeholder="What felt useful, missing, confusing, or worth building next?"
          />
          <button className="primary-action" type="submit">
            Save feedback
          </button>
        </form>
      </section>
    </main>
  );
}

function groupByModel(posts: OwnerPost[]): ModelNotebook[] {
  const notebooks = posts.reduce<Map<string, ModelNotebook>>((accumulator, post) => {
    const key = modelKeyFor(post.brand, post.model);
    const existing = accumulator.get(key);
    if (existing) {
      existing.posts.push(post);
      return accumulator;
    }

    accumulator.set(key, {
      key,
      brand: post.brand,
      model: post.model,
      posts: [post],
    });
    return accumulator;
  }, new Map<string, ModelNotebook>());

  return [...notebooks.values()].sort((first, second) => second.posts.length - first.posts.length);
}

function modelKeyFor(brand: string, model: string): string {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatMoney(amount: number): string {
  if (!amount) return "No cost logged";
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" }).format(amount);
}
