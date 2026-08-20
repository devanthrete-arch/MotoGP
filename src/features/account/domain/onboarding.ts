import { type FollowState, type GarageVehicle, type OwnerPost, type Profile, type StarterRoute } from "../../../core/entities";
import { modelKeyFor } from "../../../core/identity";

export type StarterRouteProgress = StarterRoute & {
  complete: boolean;
};

export function buildReturnNudges(input: {
  followedModelSet: Set<string>;
  followedTopicSet: Set<string>;
  garage: GarageVehicle[];
  posts: OwnerPost[];
  savedCount: number;
}): string[] {
  const followedPosts = input.posts.filter(
    (post) => input.followedModelSet.has(modelKeyFor(post.brand, post.model)) || input.followedTopicSet.has(post.label),
  );
  const latestFollowed = followedPosts[0];
  const serviceSoon = input.garage.find((vehicle) => vehicle.odometerKm > 0 && vehicle.odometerKm % 10000 >= 8500);

  return [
    latestFollowed ? `New ${latestFollowed.label.toLowerCase()} surfaced for ${latestFollowed.brand} ${latestFollowed.model}.` : null,
    input.savedCount ? `${input.savedCount} saved note${input.savedCount === 1 ? "" : "s"} waiting in your garage shelf.` : null,
    serviceSoon ? `${serviceSoon.nickname || serviceSoon.model} is close to the next 10k km service checkpoint.` : null,
  ].filter((nudge): nudge is string => Boolean(nudge));
}

export function buildStarterRouteProgress(input: {
  follows: FollowState;
  garage: GarageVehicle[];
  profile: Pick<Profile, "city" | "displayName">;
  routes: StarterRoute[];
  savedCount: number;
  shortlistCount: number;
}): StarterRouteProgress[] {
  const completedById: Record<StarterRoute["id"], boolean> = {
    follow: input.follows.models.length + input.follows.topics.length > 0,
    garage: input.garage.length > 0,
    profile: Boolean(input.profile.displayName.trim() && input.profile.city.trim()),
    save: input.savedCount + input.shortlistCount > 0,
  };

  return input.routes.map((route) => ({
    ...route,
    complete: completedById[route.id],
  }));
}
