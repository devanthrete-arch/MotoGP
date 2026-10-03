export type PitStopClip = {
  addedAt: string;
  brand?: string;
  category: "Builds" | "Launches" | "Ownership" | "India";
  embedUrl: string;
  id: string;
  model?: string;
  sourceLabel: string;
  status: "published" | "pending" | "removed";
  summary: string;
  thumbnailLabel: string;
  title: string;
};

export type PitStopReel = Pick<PitStopClip, "category" | "embedUrl" | "id" | "sourceLabel" | "summary" | "title">;

export const pitStopClips: PitStopClip[] = [
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    category: "Builds",
    embedUrl: "https://www.instagram.com/explore/tags/carsofinstagram/",
    id: "pitstop-builds-carsofinstagram",
    sourceLabel: "Instagram hashtag collection",
    status: "published",
    summary: "Explore the #carsofinstagram collection on Instagram.",
    thumbnailLabel: "IG Builds",
    title: "Cars of Instagram",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    category: "Launches",
    embedUrl: "https://www.instagram.com/explore/tags/newcar/",
    id: "pitstop-launches-newcar",
    sourceLabel: "Instagram hashtag collection",
    status: "published",
    summary: "Explore the #newcar collection on Instagram.",
    thumbnailLabel: "IG Launch",
    title: "New car collection",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    category: "Ownership",
    embedUrl: "https://www.instagram.com/explore/tags/carreview/",
    id: "pitstop-ownership-carreview",
    sourceLabel: "Instagram hashtag collection",
    status: "published",
    summary: "Explore the #carreview collection on Instagram.",
    thumbnailLabel: "IG Review",
    title: "Car review collection",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    category: "India",
    embedUrl: "https://www.instagram.com/explore/tags/indianautomotive/",
    id: "pitstop-india-automotive",
    sourceLabel: "Instagram hashtag collection",
    status: "published",
    summary: "Explore the #indianautomotive collection on Instagram.",
    thumbnailLabel: "IG India",
    title: "Indian automotive collection",
  },
];

export const pitStopCategories: Array<PitStopClip["category"] | "All"> = ["All", "Builds", "Launches", "Ownership", "India"];

export const filterPitStopClipsByCategory = (
  clips: readonly PitStopClip[],
  category: PitStopClip["category"] | "All",
): PitStopClip[] => clips.filter((clip) => category === "All" || clip.category === category);

function instagramPermalink(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username || url.password || url.port
    ) return null;

    const match = /^\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : null;
  } catch {
    return null;
  }
}

export function buildTopPitStopReels(clips: readonly PitStopClip[]): PitStopReel[] {
  const seen = new Set<string>();
  const reels: PitStopReel[] = [];
  for (const clip of clips) {
    if (clip.status !== "published") continue;
    const embedUrl = instagramPermalink(clip.embedUrl);
    if (!embedUrl || seen.has(embedUrl)) continue;
    seen.add(embedUrl);
    reels.push({
      category: clip.category,
      embedUrl,
      id: clip.id,
      sourceLabel: clip.sourceLabel,
      summary: clip.summary,
      title: clip.title,
    });
  }
  return reels;
}
