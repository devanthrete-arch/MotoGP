// Pit Stop: curated clip collections and the in-app player.
import { MouseEvent } from "react";
import { Play, X } from "lucide-react";
import { pitStopCategories } from "../../pitstop";
import { isEmbeddableReel, pitStopCollectionUrl, toEmbedSrc } from "../model";
import { useOtofolks } from "../state";

export function PitStopView() {
  const {
    selectedPitStopCategory, setSelectedPitStopCategory, selectedPitStopCollection,
    setSelectedPitStopCollection, setActiveReel, activeView, filteredPitStopClips, selectedPitStopReels,
  } = useOtofolks();
  return (
    <section className="panel pit-stop-panel" id="pit-stop" hidden={activeView !== "pit-stop"}>
      <div className="section-head">
        <div>
          <p className="eyebrow">Pit Stop</p>
          <h2>A break for your car obsession</h2>
        </div>
        <div className="pit-stop-filters" aria-label="Pit Stop category filters">
          {pitStopCategories.map((category) => (
            <button
              aria-pressed={selectedPitStopCategory === category}
              key={category}
              onClick={() => {
                setSelectedPitStopCategory(category);
                setSelectedPitStopCollection(category === "All" ? null : category);
              }}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <div className="pit-stop-grid">
        {filteredPitStopClips.map((clip) => (
          // Permalinks play in the in-app player; collections cannot be framed, so they open on Instagram.
          <a
            className="pit-stop-card"
            href={clip.embedUrl}
            key={clip.id}
            {...(isEmbeddableReel(clip.embedUrl)
              ? { onClick: (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); setActiveReel(clip); } }
              : { target: "_blank", rel: "noopener noreferrer" })}
          >
            <div className="pit-stop-thumb" aria-hidden="true">
              <span className="play-badge"><Play size={20} /></span>
              <strong>{clip.thumbnailLabel}</strong>
              <small>{clip.brand ?? "Cars"}</small>
            </div>
            <span>{clip.category}</span>
            <h3>{clip.title}</h3>
            <p>{clip.summary}</p>
            {clip.brand && clip.model ? <small>Related: {clip.brand} {clip.model}</small> : null}
            <em>{isEmbeddableReel(clip.embedUrl) ? "Play clip" : "Explore on Instagram (opens a new tab)"}</em>
          </a>
        ))}
      </div>
      {selectedPitStopCollection && selectedPitStopReels.length > 0 ? (
      <div className="pit-stop-reel-section" id={pitStopCollectionUrl(selectedPitStopCollection).slice(2)}>
        <div className="section-head compact">
          <div>
            <p className="eyebrow">{selectedPitStopCollection}</p>
            <h3>Selected clips</h3>
          </div>
          <span className="form-note">{selectedPitStopReels.length} clips</span>
        </div>
        <div className="pit-stop-reel-grid">
          {selectedPitStopReels.map((reel) => (
            <a className="pit-stop-reel-card" href={reel.embedUrl} key={reel.id} rel="noreferrer" target="_blank">
              <span>{reel.category}</span>
              <h4>{reel.title}</h4>
              <p>{reel.summary}</p>
              <em>{reel.sourceLabel}</em>
            </a>
          ))}
        </div>
      </div>
      ) : null}
    </section>
  );
}

/** Player dialog for a clip that can be embedded. */
export function ReelModal() {
  const { activeReel, setActiveReel } = useOtofolks();
  return (
    <>
      {activeReel ? (
        <div className="reel-modal" role="dialog" aria-modal="true" aria-label={activeReel.title}
          onClick={(event) => { if (event.target === event.currentTarget) setActiveReel(null); }}>
          <div className="reel-modal-card">
            <div className="reel-modal-head">
              <div>
                <span className="pill">{activeReel.category}</span>
                <h3>{activeReel.title}</h3>
              </div>
              <button className="composer-close" type="button" aria-label="Close" onClick={() => setActiveReel(null)}>
                <X size={20} />
              </button>
            </div>
            {isEmbeddableReel(activeReel.embedUrl) ? (
              <div className="reel-frame">
                <iframe
                  src={toEmbedSrc(activeReel.embedUrl)}
                  title={activeReel.title}
                  loading="lazy"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="reel-collection" aria-hidden="true">
                <span className="play-badge"><Play size={24} /></span>
                <strong>{activeReel.thumbnailLabel}</strong>
                <small>{activeReel.category} · curated collection</small>
              </div>
            )}
            <p>{activeReel.summary}</p>
            <a className="secondary-action" href={activeReel.embedUrl} target="_blank" rel="noreferrer">
              {isEmbeddableReel(activeReel.embedUrl) ? "Open on Instagram" : "Watch the collection on Instagram"}
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
