import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Play, X } from "lucide-react";

export const pitStopCategories = ["All", "Builds", "Launches", "Ownership", "India"] as const;
export type PitStopCategory = Exclude<(typeof pitStopCategories)[number], "All">;
export type PitStopStatus = "published" | "pending" | "removed";

export type PitStopClip = {
  addedAt: string;
  brand?: string;
  category: PitStopCategory;
  embedUrl: string;
  id: string;
  model?: string;
  sourceLabel: string;
  status: PitStopStatus;
  summary: string;
  thumbnailLabel: string;
  thumbnailUrl?: string;
  title: string;
};

export type PitStopMedia = { platform: "Instagram" | "YouTube"; src: string; aspect: "vertical" | "wide"; thumbnailUrl?: string };

export function resolvePitStopMedia(url: string): PitStopMedia | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "instagram.com" && /\/(reel|reels|p|tv)\//.test(parsed.pathname)) {
      const path = parsed.pathname.replace(/\/$/, "");
      return { platform: "Instagram", src: `https://www.instagram.com${path}/embed/`, aspect: "vertical" };
    }

    if (["youtu.be", "youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      let id = "";
      if (host === "youtu.be") id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      else if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") ?? "";
      else if (/^\/(shorts|embed|live)\//.test(parsed.pathname)) id = parsed.pathname.split("/")[2] ?? "";
      if (/^[\w-]{11}$/.test(id)) {
        return {
          platform: "YouTube",
          src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,
          aspect: "wide",
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function topPitStopItems(clips: PitStopClip[], category: PitStopCategory | "All"): PitStopClip[] {
  return clips
    .filter((clip) => clip.status === "published" && (category === "All" || clip.category === category))
    .sort((first, second) => Date.parse(second.addedAt) - Date.parse(first.addedAt))
    .slice(0, 50);
}

const categoryLabel = (category: PitStopCategory | "All") => category;
const hashCategory = (): PitStopCategory | "All" => {
  const value = typeof window === "undefined" ? "" : window.location.hash.replace(/^#pit-stop-?/i, "");
  return pitStopCategories.find((category) => category.toLowerCase() === value.toLowerCase()) ?? "All";
};

export function PitStopSection({ clips, hidden = false }: { clips: PitStopClip[]; hidden?: boolean }) {
  const [category, setCategory] = useState<PitStopCategory | "All">(hashCategory);
  const [activeClip, setActiveClip] = useState<PitStopClip | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleClips = useMemo(() => topPitStopItems(clips, category), [clips, category]);
  const activeMedia = activeClip ? resolvePitStopMedia(activeClip.embedUrl) : null;

  const closePlayer = () => {
    setActiveClip(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!activeClip) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePlayer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeClip]);

  return (
    <section className="panel pit-stop-panel" id="pit-stop" hidden={hidden}>
      <div className="section-head">
        <div><p className="eyebrow">Garage TV</p><h2>Pitstop</h2></div>
        <div className="pit-stop-filters" aria-label="Pitstop categories" role="group">
          {pitStopCategories.map((item) => (
            <button
              aria-pressed={category === item}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {categoryLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {visibleClips.length ? (
        <div className="pit-stop-grid" aria-live="polite">
          {visibleClips.map((clip) => {
            const media = resolvePitStopMedia(clip.embedUrl);
            const PlatformIcon = media?.platform === "Instagram" ? Camera : Play;
            return (
              <button
                aria-label={`Play ${clip.title} in Pitstop`}
                className="pit-stop-card"
                key={clip.id}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setActiveClip(clip);
                }}
                type="button"
              >
                <span className={`pit-stop-thumb ${media?.aspect === "wide" ? "is-wide" : "is-vertical"}`}>
                  {clip.thumbnailUrl ?? media?.thumbnailUrl ? <img alt="" loading="lazy" src={clip.thumbnailUrl ?? media?.thumbnailUrl} /> : (
                    <span className="pit-stop-thumb-art" aria-hidden="true">
                      <PlatformIcon size={28} />
                      <strong>{clip.thumbnailLabel}</strong>
                    </span>
                  )}
                  <span className="pit-stop-platform"><PlatformIcon size={15} />{media?.platform ?? "YouTube"}</span>
                  <span className="play-badge"><Play size={20} fill="currentColor" /></span>
                </span>
                <span className="pit-stop-card-category">{categoryLabel(clip.category)}</span>
                <strong className="pit-stop-card-title">{clip.title}</strong>
                <span className="pit-stop-card-summary">{clip.summary}</span>
                <span className={`pit-stop-card-status ${media ? "is-ready" : ""}`}>
                  {media ? "Play in Pitstop" : "In-app player · link needed"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pit-stop-empty" role="status">
          <Camera size={22} aria-hidden="true" />
          <strong>No videos in this category yet</strong>
          <span>The daily YouTube refresh will add videos here.</span>
        </div>
      )}

      {activeClip ? (
        <div
          className="reel-modal"
          onClick={(event) => { if (event.target === event.currentTarget) closePlayer(); }}
        >
          <section className="reel-modal-card pit-stop-player" role="dialog" aria-modal="true" aria-labelledby="pitstop-player-title">
            <div className="reel-modal-head">
              <div>
                <span className="pill">{categoryLabel(activeClip.category)}</span>
                <h3 id="pitstop-player-title">{activeClip.title}</h3>
              </div>
              <button className="composer-close" type="button" aria-label="Close player" onClick={closePlayer}>
                <X size={20} />
              </button>
            </div>
            {activeMedia ? (
              <div className={`reel-frame reel-frame--${activeMedia.aspect}`}>
                <iframe
                  allow="autoplay; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={activeMedia.src}
                  title={activeClip.title}
                />
              </div>
            ) : (
              <div className="pit-stop-unavailable" role="status">
                <Camera size={26} aria-hidden="true" />
                <strong>This video cannot play in the in-app player.</strong>
                <span>Choose another video; some creators turn off embedded playback.</span>
              </div>
            )}
            <p>{activeClip.summary}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
