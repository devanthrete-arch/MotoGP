import { useEffect, useRef, useState } from "react";
import { Play, Search, X } from "lucide-react";
import { parsePitStopVideos, pitStopCategories, type PitStopVideo } from "../../pitstop";
import { useOtofolks } from "../state";
import "./PitStopView.css";

const feedUrl = import.meta.env.VITE_PITSTOP_API_URL?.trim() || "/api/pitstop/videos";

export function PitStopView() {
  const { selectedPitStopCategory, setSelectedPitStopCategory } = useOtofolks();
  const [videos, setVideos] = useState<PitStopVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeVideo, setActiveVideo] = useState<PitStopVideo | null>(null);
  const [query, setQuery] = useState("");
  const visibleVideos = videos.filter((video) => `${video.title} ${video.channel}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const url = new URL(feedUrl, window.location.origin);
        url.searchParams.set("category", selectedPitStopCategory);
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        const payload = await response.json();
        if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Videos could not be loaded. Please try again.");
        const result = parsePitStopVideos(payload, selectedPitStopCategory);
        setVideos(result);
        if (!result.length) setError("No videos are available in this collection yet.");
      } catch (reason) {
        if (!controller.signal.aborted) {
          setVideos([]);
          setError(reason instanceof Error ? reason.message : "Videos could not be loaded. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedPitStopCategory]);

  return (
    <section className="panel pit-stop-panel pitstop-hub" id="pit-stop">
      <div className="pitstop-heading">
        <div className="pitstop-title"><p className="eyebrow">WATCH · LEARN · GET INSPIRED</p><h1>Pit Stop</h1><p>Fresh builds, helpful know-how and stories from the road.</p></div>
        <div className="pitstop-tabs" role="group" aria-label="Video categories">
          {pitStopCategories.map((category) => (
            <button key={category} type="button" aria-pressed={selectedPitStopCategory === category}
              onClick={() => setSelectedPitStopCategory(category)}>{category}</button>
          ))}
        </div>
      </div>

      <label className="pitstop-search"><Search size={18} aria-hidden="true" />
        <span className="ui-visually-hidden">Search videos</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search videos or channels" />
      </label>

      {loading ? <div className="pitstop-state" role="status">Finding videos for you…</div> : null}
      {!loading && error ? <div className="pitstop-state" role="status"><strong>{error}</strong><span>New videos appear here when the collection is available.</span></div> : null}
      {!loading && videos.length && visibleVideos.length ? (
        <>
          <div className="pitstop-feature-layout">
            <button className="pitstop-feature" type="button" onClick={() => setActiveVideo(visibleVideos[0])}
              aria-label={`${visibleVideos[0].embeddable ? "Play" : "View details for"} ${visibleVideos[0].title}`}>
              <span className="pitstop-thumb"><img src={visibleVideos[0].thumbnailUrl} alt="" /><span className="pitstop-play"><Play size={21} fill="currentColor" /></span>
                {visibleVideos[0].duration ? <span className="pitstop-duration">{visibleVideos[0].duration}</span> : null}</span>
              <span className="pitstop-feature-copy"><span className="pitstop-feature-tag">FEATURED VIDEO</span><strong>{visibleVideos[0].title}</strong><span>{visibleVideos[0].channel}</span></span>
            </button>
            <div className="pitstop-dispatches"><div className="pitstop-dispatches-head"><div><p className="eyebrow">THE LATEST</p><h2>More to explore</h2></div><span>{visibleVideos.length} videos</span></div>
              {visibleVideos.slice(1).map((video) => <button className="pitstop-video" key={video.id} type="button" onClick={() => setActiveVideo(video)}
                aria-label={`${video.embeddable ? "Play" : "View details for"} ${video.title}`}>
                <span className="pitstop-thumb"><img src={video.thumbnailUrl} alt="" loading="lazy" /><span className="pitstop-play"><Play size={16} fill="currentColor" /></span>
                  {video.duration ? <span className="pitstop-duration">{video.duration}</span> : null}</span>
                <span className="pitstop-video-copy"><strong>{video.title}</strong><span>{video.channel}</span></span>
              </button>)}
            </div>
          </div>
        </>
      ) : null}
      {!loading && videos.length > 0 && visibleVideos.length === 0 ? <div className="pitstop-state" role="status">No videos match that search.</div> : null}

      {activeVideo ? <PitStopPlayer video={activeVideo} onClose={() => setActiveVideo(null)} /> : null}
    </section>
  );
}

function PitStopPlayer({ video, onClose }: { video: PitStopVideo; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = Array.from(document.querySelectorAll<HTMLElement>(
          ".pitstop-dialog button, .pitstop-dialog a[href], .pitstop-dialog iframe",
        ));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="pitstop-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pitstop-dialog" role="dialog" aria-modal="true" aria-labelledby="pitstop-dialog-title">
        <header className="pitstop-dialog-head">
          <div><span>{video.category} · YouTube</span><h2 id="pitstop-dialog-title">{video.title}</h2><p>{video.channel}</p></div>
          <button ref={closeRef} className="pitstop-close" type="button" aria-label="Close video" onClick={onClose}><X /></button>
        </header>
        {video.embeddable ? (
          <div className="pitstop-player">
            <iframe key={video.videoId} src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
              title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          </div>
        ) : <p className="pitstop-unavailable" role="status">This video cannot be played here. You can watch it on YouTube instead.</p>}
        {video.embeddable ? <p className="pitstop-fallback">If playback is unavailable, <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer">watch on YouTube</a>.</p> :
          <a className="pitstop-watch-link" href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer">Watch on YouTube</a>}
      </section>
    </div>
  );
}

// The app shell still imports this legacy export; playback now lives in PitStopView.
export function ReelModal() { return null; }
