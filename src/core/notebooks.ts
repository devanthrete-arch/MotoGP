import { type ModelNotebook, type OwnerPost } from "./entities";
import { modelKeyFor } from "./identity";

/**
 * Groups owner posts into the `ModelNotebook` entity. Both the community feed
 * and the ownership playbooks read notebooks, which is why the constructor sits
 * in `core` rather than in either feature.
 */
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
