import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const queries = [
  ["Builds", "car bike builds modifications India walkaround"],
  ["Launches", "new car motorcycle launches India first look walkaround"],
  ["Ownership", "car bike ownership review maintenance India long term"],
  ["India", "Indian roads car motorcycle review road test"],
];

export function buildCatalog(results, generatedAt = new Date().toISOString()) {
  const seen = new Set();
  const clips = [];

  for (const { category, items } of results) {
    for (const item of items) {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet || seen.has(videoId)) continue;
      seen.add(videoId);

      const thumbnail = snippet.thumbnails?.high ?? snippet.thumbnails?.medium ?? snippet.thumbnails?.default;
      clips.push({
        addedAt: snippet.publishedAt ?? generatedAt,
        category,
        embedUrl: `https://www.youtube.com/watch?v=${videoId}`,
        id: `youtube-${videoId}`,
        sourceLabel: `${snippet.channelTitle || "YouTube"} · YouTube`,
        status: "published",
        summary: (snippet.description || "Watch on YouTube.").slice(0, 320),
        thumbnailLabel: snippet.channelTitle || "YouTube",
        ...(thumbnail?.url ? { thumbnailUrl: thumbnail.url } : {}),
        title: snippet.title || "Automotive video",
      });
    }
  }

  return { generatedAt, source: "YouTube Data API", clips };
}

export async function discoverPitstop({ apiKey, outputPath, fetchImpl = fetch, writeFileImpl = writeFile }) {
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is required.");
  const results = [];

  for (const [category, q] of queries) {
    const params = new URLSearchParams({
      key: apiKey,
      part: "snippet",
      q,
      maxResults: "50",
      order: "relevance",
      regionCode: "IN",
      relevanceLanguage: "en",
      safeSearch: "strict",
      type: "video",
      videoEmbeddable: "true",
    });
    const response = await fetchImpl(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) throw new Error(`YouTube search failed (${response.status}) for ${category}.`);
    const data = await response.json();
    results.push({ category, items: Array.isArray(data.items) ? data.items : [] });
  }

  const catalog = buildCatalog(results);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFileImpl(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return catalog;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const outputPath = path.resolve(process.env.PITSTOP_OUTPUT ?? "public/pitstop-videos.json");
  try {
    const catalog = await discoverPitstop({ apiKey: process.env.YOUTUBE_API_KEY, outputPath });
    console.log(`Updated Pitstop catalog with ${catalog.clips.length} videos.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Pitstop discovery failed.");
    process.exitCode = 1;
  }
}
