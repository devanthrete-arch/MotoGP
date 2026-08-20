import { type OwnerPost } from "../../../core/entities";
import { type CityCircle } from "../../../core/projections";

export type EvidenceScore = {
  score: number;
  maxScore: number;
  tier: "Thin" | "Useful" | "Strong";
  reasons: string[];
};

/**
 * Richer evidence scoring for a model playbook page: breadth of note types,
 * corroboration, odometer reach, city spread, and community usefulness.
 */
export function scorePlaybookEvidence(posts: OwnerPost[]): EvidenceScore {
  const labels = new Set(posts.map((post) => post.label));
  const cities = new Set(posts.map((post) => post.city.trim().toLowerCase()).filter(Boolean));
  const helpful = posts.reduce((total, post) => total + post.helpful, 0);
  const confirmed = posts.reduce((total, post) => total + post.fixesConfirmed, 0);
  const highestOdometer = posts.reduce((highest, post) => Math.max(highest, post.odometerKm), 0);

  const checks = [
    { detail: `${posts.length} owner note${posts.length === 1 ? "" : "s"} on record.`, passed: posts.length >= 2 },
    { detail: "Known issues and fixes are both documented.", passed: labels.has("Known issue") && labels.has("Fix") },
    { detail: "Running-cost evidence is available.", passed: labels.has("Cost note") },
    { detail: `Notes come from ${cities.size} cit${cities.size === 1 ? "y" : "ies"}.`, passed: cities.size >= 2 },
    { detail: `Community marked these notes helpful ${helpful} time${helpful === 1 ? "" : "s"}.`, passed: helpful >= 10 },
    { detail: `${confirmed} owner-confirmed fix${confirmed === 1 ? "" : "es"}.`, passed: confirmed >= 1 },
    { detail: `Evidence reaches ${highestOdometer.toLocaleString("en-IN")} km.`, passed: highestOdometer >= 20000 },
  ];

  const passed = checks.filter((check) => check.passed);

  return {
    maxScore: checks.length,
    reasons: passed.length ? passed.map((check) => check.detail) : ["Not enough owner evidence yet for this model."],
    score: passed.length,
    tier: passed.length >= 5 ? "Strong" : passed.length >= 3 ? "Useful" : "Thin",
  };
}

/** Evidence scoring for a city circle page. */
export function scoreCityEvidence(circle: Pick<CityCircle, "garageVehicles" | "posts" | "topBrands">): EvidenceScore {
  const helpful = circle.posts.reduce((total, post) => total + post.helpful, 0);
  const labels = new Set(circle.posts.map((post) => post.label));

  const checks = [
    { detail: `${circle.posts.length} owner note${circle.posts.length === 1 ? "" : "s"} from this city.`, passed: circle.posts.length >= 2 },
    { detail: `${circle.topBrands.length} brand${circle.topBrands.length === 1 ? "" : "s"} discussed locally.`, passed: circle.topBrands.length >= 2 },
    { detail: `${circle.garageVehicles.length} garage vehicle${circle.garageVehicles.length === 1 ? "" : "s"} registered here.`, passed: circle.garageVehicles.length >= 1 },
    { detail: `${labels.size} different note type${labels.size === 1 ? "" : "s"} represented.`, passed: labels.size >= 3 },
    { detail: `Local notes marked helpful ${helpful} time${helpful === 1 ? "" : "s"}.`, passed: helpful >= 10 },
  ];

  const passed = checks.filter((check) => check.passed);

  return {
    maxScore: checks.length,
    reasons: passed.length ? passed.map((check) => check.detail) : ["This city circle is still forming."],
    score: passed.length,
    tier: passed.length >= 4 ? "Strong" : passed.length >= 2 ? "Useful" : "Thin",
  };
}
