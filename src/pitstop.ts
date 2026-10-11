export const pitStopCategories = ["All", "Builds", "Launches", "Ownership", "India"] as const;
export type PitStopCategory = (typeof pitStopCategories)[number];

// Retained for the app's legacy collection-link types. No placeholder records are shipped.
export type PitStopClip = {
  addedAt: string;
  brand?: string;
  category: Exclude<PitStopCategory, "All">;
  embedUrl: string;
  id: string;
  model?: string;
  sourceLabel: string;
  status: "published" | "pending" | "removed";
  summary: string;
  thumbnailLabel: string;
  title: string;
};

export type PitStopVideo = {
  category: Exclude<PitStopCategory, "All">;
  channel: string;
  duration?: string;
  embeddable: boolean;
  id: string;
  thumbnailUrl: string;
  title: string;
  videoId: string;
};

export type PitStopReel = Pick<PitStopClip, "category" | "embedUrl" | "id" | "sourceLabel" | "summary" | "title">;

export const pitStopClips: PitStopClip[] = [];

export const filterPitStopClipsByCategory = (
  clips: readonly PitStopClip[],
  category: PitStopCategory,
): PitStopClip[] => clips.filter((clip) => category === "All" || clip.category === category);

export function youtubeVideoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) return null;
    const id = url.pathname === "/watch" ? url.searchParams.get("v")
      : /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parsePitStopVideos(payload: unknown, category: PitStopCategory): PitStopVideo[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { videos?: unknown }).videos)) return [];
  const videos: PitStopVideo[] = [];
  const seen = new Set<string>();
  for (const value of (payload as { videos: unknown[] }).videos) {
    if (videos.length === 50) break;
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const videoId = youtubeVideoId(item.videoId ?? item.url);
    const itemCategory = item.category;
    const resolvedCategory = category === "All" ? itemCategory : category;
    if (!videoId || typeof item.title !== "string" || !item.title.trim()
      || typeof item.channel !== "string" || !item.channel.trim()
      || typeof item.embeddable !== "boolean"
      || !pitStopCategories.slice(1).includes(resolvedCategory as Exclude<PitStopCategory, "All">)
      || (category !== "All" && itemCategory !== undefined && itemCategory !== category)
      || seen.has(videoId)) continue;
    seen.add(videoId);
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    if (typeof item.thumbnailUrl === "string") {
      try {
        const url = new URL(item.thumbnailUrl);
        if (url.protocol === "https:" && url.hostname === "i.ytimg.com") thumbnailUrl = url.href;
      } catch { /* use YouTube's canonical thumbnail for this real video ID */ }
    }
    videos.push({
      category: resolvedCategory as Exclude<PitStopCategory, "All">,
      channel: item.channel.trim(),
      ...(typeof item.duration === "string" && item.duration.trim() ? { duration: item.duration.trim() } : {}),
      embeddable: item.embeddable,
      id: typeof item.id === "string" && item.id.trim() ? item.id : videoId,
      thumbnailUrl,
      title: item.title.trim(),
      videoId,
    });
  }
  return videos;
}

// Instagram collections are intentionally not converted into individual reels.
export function buildTopPitStopReels(clips: readonly PitStopClip[]): PitStopReel[] {
  const seen = new Set<string>();
  const reels: PitStopReel[] = [];
  for (const clip of clips) {
    if (clip.status !== "published") continue;
    try {
      const url = new URL(clip.embedUrl);
      if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname)) continue;
      const match = /^\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
      if (!match) continue;
      const embedUrl = `https://www.instagram.com/${match[1]}/${match[2]}/`;
      if (seen.has(embedUrl)) continue;
      seen.add(embedUrl);
      reels.push({ category: clip.category, embedUrl, id: clip.id, sourceLabel: clip.sourceLabel, summary: clip.summary, title: clip.title });
    } catch { /* ignore malformed collection records */ }
  }
  return reels;
}
