import { type ModelNotebook, type OwnerPost } from "./entities";
import { modelKeyFor } from "./identity";

export function groupByModel(posts: OwnerPost[]): ModelNotebook[] {
  const notebooks = posts.reduce<Map<string, ModelNotebook>>((accumulator, post) => {
    const key = modelKeyFor(post.brand, post.model);
    const existing = accumulator.get(key);
    if (existing) {
      existing.posts.push(post);
      return accumulator;
    }

    accumulator.set(key, {
      key,
      brand: post.brand,
      model: post.model,
      posts: [post],
    });
    return accumulator;
  }, new Map<string, ModelNotebook>());

  return [...notebooks.values()].sort((first, second) => second.posts.length - first.posts.length);
}
