import { type ModelNotebook, type OwnerPost } from "../../../core/entities";

export type SharePayload = {
  title: string;
  text: string;
};

export function buildPostSharePayload(post: OwnerPost): SharePayload {
  return {
    title: `${post.brand} ${post.model}: ${post.title}`,
    text: [
      `${post.title}`,
      `${post.label} for ${post.brand} ${post.model}${post.variant ? ` ${post.variant}` : ""}`,
      `${post.city || "City not shared"} · ${post.odometerKm.toLocaleString("en-IN")} km · ${post.helpful} helpful`,
      post.body.slice(0, 180),
    ].join("\n"),
  };
}

export function buildModelSharePayload(notebook: ModelNotebook): SharePayload {
  const labels = [...new Set(notebook.posts.map((post) => post.label))].join(", ");
  return {
    title: `${notebook.brand} ${notebook.model} owner notebook`,
    text: `${notebook.brand} ${notebook.model} has ${notebook.posts.length} Autoflex owner note${
      notebook.posts.length === 1 ? "" : "s"
    }: ${labels || "owner notes"}.`,
  };
}
