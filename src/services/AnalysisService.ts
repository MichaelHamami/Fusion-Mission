import { FeedbackDao } from "../dao/FeedbackDao";
import { AnalysisDao, AiRequestError } from "../dao/AnalysisDao";
import { AnalysisResultSchema } from "../schemas/analysisSchema";
import {
  AnalysisRateLimiter,
  RATE_LIMIT_MAX_ANALYSES,
  RATE_LIMIT_WINDOW_MS,
} from "./AnalysisRateLimiter";

export class AnalysisService {
  static async analyzeFeedback(feedbackId: string): Promise<void> {
    const feedback = FeedbackDao.findById(feedbackId);
    if (!feedback) {
      console.error(`analyzeFeedback: no feedback found for id ${feedbackId}`);
      return;
    }

    FeedbackDao.updateStatus(feedbackId, "ANALYZING");

    if (!AnalysisRateLimiter.tryAcquire()) {
      FeedbackDao.saveAnalysisFailure(
        feedbackId,
        `Rate limit exceeded: max ${RATE_LIMIT_MAX_ANALYSES} AI analyses per ${
          RATE_LIMIT_WINDOW_MS / 1000
        }s. Retry later.`,
        null
      );
      return;
    }

    let rawResponse: string;
    try {
      rawResponse = await AnalysisDao.requestAnalysis(feedback.content);
    } catch (error) {
      const reason =
        error instanceof AiRequestError
          ? error.message
          : `Unexpected error: ${(error as Error).message}`;
      FeedbackDao.saveAnalysisFailure(feedbackId, reason, null);
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(AnalysisService.stripMarkdownFence(rawResponse));
    } catch {
      FeedbackDao.saveAnalysisFailure(
        feedbackId,
        "AI response was not valid JSON",
        rawResponse
      );
      return;
    }

    const validation = AnalysisResultSchema.safeParse(parsedJson);
    if (!validation.success) {
      FeedbackDao.saveAnalysisFailure(
        feedbackId,
        `AI response failed schema validation: ${validation.error.message}`,
        rawResponse
      );
      return;
    }

    FeedbackDao.saveAnalysisSuccess(
      feedbackId,
      rawResponse,
      JSON.stringify(validation.data)
    );
  }

  /**
   * The model is instructed to return bare JSON, but LLMs sometimes wrap
   * output in a ```json ... ``` fence anyway. Stripping a fence if present
   * is a defensive parsing step, not a relaxation of the schema - the
   * content inside still has to pass AnalysisResultSchema untouched.
   */
  private static stripMarkdownFence(raw: string): string {
    const fenced = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1] : raw;
  }
}
