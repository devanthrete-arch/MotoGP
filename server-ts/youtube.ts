import { pitStopCategories, type PitStopCategory } from "../src/pitstop";

type YouTubeSearchResult = {
  id?: { videoId?: string };
  snippet?: { channelTitle?: string; title?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } };
};
type YouTubeVideoDetails = { id?: string; contentDetails?: { duration?: string }; status?: { embeddable?: boolean } };

const terms: Record<Exclude<PitStopCategory, "All">, string> = {
  Builds: "car bike custom build restoration India",
  India: "car bike ownership India maintenance",
  Launches: "new car motorcycle launch India",
  Ownership: "car bike maintenance ownership tips India",
};
const cache = new Map<string, { expiresAt: number; videos: unknown[] }>();
const cacheMs = 6 * 60 * 60 * 1000;

function displayDuration(value: string | undefined): string | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export async function searchPitStopVideos(categoryValue: unknown, apiKey = process.env.YOUTUBE_API_KEY): Promise<{ videos: unknown[]; error?: string; status: number }> {
  if (typeof categoryValue !== "string" || !pitStopCategories.includes(categoryValue as PitStopCategory)) {
    return { status: 400, videos: [], error: "Choose a valid video category." };
  }
  if (!apiKey?.trim()) return { status: 503, videos: [], error: "Video search is not configured yet." };
  const category = categoryValue as PitStopCategory;
  const cacheKey = category;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { status: 200, videos: cached.videos };

  const query = category === "All" ? "car bike builds launches ownership India" : terms[category];
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    key: apiKey,
    maxResults: "50",
    order: "relevance",
    q: query,
    regionCode: "IN",
    relevanceLanguage: "en",
    safeSearch: "strict",
    type: "video",
    videoEmbeddable: "true",
    videoLicense: "creativeCommon",
  }).toString();

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const status = response.status === 403 ? 503 : 502;
    return { status, videos: [], error: response.status === 403
      ? "YouTube search is unavailable. Check the API key, quota, or project restrictions."
      : "YouTube search is temporarily unavailable." };
  }
  const payload = await response.json() as { items?: YouTubeSearchResult[] };
  const items = Array.isArray(payload.items) ? payload.items : [];
  const ids = items.map((item) => item.id?.videoId).filter((id): id is string => Boolean(id && /^[A-Za-z0-9_-]{11}$/.test(id)));
  const details = new Map<string, YouTubeVideoDetails>();
  if (ids.length) {
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.search = new URLSearchParams({ id: ids.join(","), key: apiKey, part: "contentDetails,status" }).toString();
    try {
      const detailsResponse = await fetch(detailsUrl, { headers: { Accept: "application/json" } });
      if (detailsResponse.ok) {
        const detailsPayload = await detailsResponse.json() as { items?: YouTubeVideoDetails[] };
        for (const item of detailsPayload.items ?? []) if (item.id) details.set(item.id, item);
      }
    } catch { /* search results remain usable if duration lookup fails */ }
  }
  const videos = items.flatMap((item) => {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title?.trim();
    const channel = item.snippet?.channelTitle?.trim();
    if (!videoId || !title || !channel || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return [];
    const videoDetails = details.get(videoId);
    if (videoDetails?.status?.embeddable === false) return [];
    const thumbnailUrl = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url
      ?? item.snippet?.thumbnails?.default?.url;
    return [{
      category: category === "All" ? "Ownership" : category,
      channel,
      embeddable: videoDetails?.status?.embeddable ?? true,
      id: videoId,
      ...(displayDuration(videoDetails?.contentDetails?.duration) ? { duration: displayDuration(videoDetails?.contentDetails?.duration) } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      title,
      videoId,
    }];
  });
  cache.set(cacheKey, { expiresAt: Date.now() + cacheMs, videos });
  return { status: 200, videos };
}
