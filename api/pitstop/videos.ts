import { searchPitStopVideos } from "../../server-ts/youtube";

export default async function handler(request: { method?: string; query?: { category?: string | string[] } }, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  try {
    const category = Array.isArray(request.query?.category) ? request.query.category[0] : request.query?.category;
    const { videos, error, status } = await searchPitStopVideos(category);
    if (error) return response.status(status).json({ error });
    response.setHeader("Cache-Control", "public, max-age=21600, stale-while-revalidate=86400");
    return response.status(200).json({ videos });
  } catch {
    return response.status(502).json({ error: "YouTube search is temporarily unavailable." });
  }
}
