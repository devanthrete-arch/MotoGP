import { type OwnerPost } from "./entities";

/**
 * Post-quality scoring: a domain invariant, not a feature preference.
 *
 * The community composer shows the score live, and `infrastructure/hosted`
 * persists the same report to `post_quality` so the feed can rank on it. Both
 * sides have to agree on the rule, so the rule is core.
 */
export type PostQualityInput = Pick<OwnerPost, "body" | "city" | "label" | "odometerKm" | "variant">;

export type PostQualityReport = {
  score: number;
  maxScore: number;
  grade: "Needs context" | "Useful draft" | "Garage-grade";
  strengths: string[];
  missingPrompts: string[];
};

export function assessPostQuality(post: PostQualityInput): PostQualityReport {
  const body = post.body.trim().toLowerCase();
  const checks = [
    {
      passed: Boolean(post.variant.trim()),
      strength: "Variant is included, so advice maps to the right trim/engine.",
      prompt: "Add variant, fuel, gearbox, or trim so readers do not overgeneralize.",
    },
    {
      passed: Boolean(post.city.trim()),
      strength: "City is included, which helps readers judge traffic, climate, and road context.",
      prompt: "Add city or route context because usage pattern changes the ownership story.",
    },
    {
      passed: post.odometerKm > 0,
      strength: "Odometer is included, so wear-and-tear claims have a timeline.",
      prompt: "Add odometer reading to anchor the issue, review, or cost note.",
    },
    {
      passed: body.length >= 180,
      strength: "The note has enough depth for a future owner to learn from it.",
      prompt: "Add symptoms, decision path, failed attempts, bill details, or what changed after the fix.",
    },
    {
      passed: /(₹|rs\.?|inr|cost|paid|bill|labou?r|part|quote)/i.test(post.body),
      strength: "Cost or bill language is present, making the note more actionable.",
      prompt: "Mention cost, bill split, quote, or whether no money was spent.",
    },
    {
      passed: /(fixed|resolved|worked|held|failed|recommend|avoid|would|wouldn't|inspection|check)/i.test(post.body),
      strength: "Outcome language is present, so readers know what to do next.",
      prompt: "Add the outcome: what worked, what failed, what to check, or what you would do differently.",
    },
  ];

  const strengths = checks.filter((check) => check.passed).map((check) => check.strength);
  const missingPrompts = checks.filter((check) => !check.passed).map((check) => check.prompt);
  const score = strengths.length;
  const grade: PostQualityReport["grade"] = score >= 5 ? "Garage-grade" : score >= 3 ? "Useful draft" : "Needs context";

  return {
    grade,
    maxScore: checks.length,
    missingPrompts,
    score,
    strengths,
  };
}
