// The long-form owner-note composer.
import { knowledgeLabels, type KnowledgeLabel } from "../../domain";
import { brands } from "../model";
import { useOtofolks } from "../state";

export function WriteView() {
  const {
    auth, communityStatus, communityBusy, draft, setDraft, activeView, isOnline, draftQuality, publishPost,
  } = useOtofolks();
  return (
    <section className="panel split-panel" id="write" hidden={activeView !== "write"}>
      <div>
        <p className="eyebrow">Owner note</p>
        <h2>What did you learn about your car?</h2>
        <p>Your note will be published to signed-in community members.</p>
        {communityStatus ? <p role="status">{communityStatus}</p> : null}
        <div className={`quality-card ${draftQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className="quality-meter" aria-label={`Draft detail quality ${draftQuality.score} of ${draftQuality.maxScore}`}>
            <span style={{ width: `${(draftQuality.score / draftQuality.maxScore) * 100}%` }} />
          </div>
          <strong>
            Detail meter: {draftQuality.grade} · {draftQuality.score}/{draftQuality.maxScore}
          </strong>
          <div className="quality-prompts">
            {(draftQuality.missingPrompts.length ? draftQuality.missingPrompts : draftQuality.strengths).slice(0, 3).map((prompt) => (
              <p key={prompt}>{prompt}</p>
            ))}
          </div>
        </div>
      </div>
      <form className="composer" onSubmit={publishPost}>
        <input
          required
          maxLength={160}
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
          maxLength={10000}
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
        />
        <button className="primary-action" disabled={communityBusy || !auth.cloudClient || !isOnline} type="submit">
          Publish owner note
        </button>
      </form>
    </section>
  );
}
