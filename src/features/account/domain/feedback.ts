import { type BuildRole, type FeedbackNote, type FeedbackStatus } from "../../../core/entities";

export type FeedbackTriageSummary = Record<FeedbackStatus, number>;

export type FeedbackLoopSummary = Record<BuildRole, number>;

export function buildFeedbackLoopSummary(feedback: FeedbackNote[]): FeedbackLoopSummary {
  return feedback.reduce<FeedbackLoopSummary>(
    (summary, note) => ({
      ...summary,
      [note.loopStage]: summary[note.loopStage] + 1,
    }),
    {
      "Backend engineer": 0,
      Designer: 0,
      "Frontend engineer": 0,
      "Product owner": 0,
      "Real user": 0,
      "Tested / QA": 0,
    },
  );
}

export function buildFeedbackTriageSummary(feedback: FeedbackNote[]): FeedbackTriageSummary {
  return feedback.reduce<FeedbackTriageSummary>(
    (summary, note) => ({
      ...summary,
      [note.status]: summary[note.status] + 1,
    }),
    {
      New: 0,
      Planned: 0,
      Reviewing: 0,
      Shipped: 0,
    },
  );
}
