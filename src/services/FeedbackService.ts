import { randomUUID } from "node:crypto";
import { FeedbackDao } from "../dao/FeedbackDao";
import { AnalysisService } from "./AnalysisService";
import { FeedbackListOptions, FeedbackRow } from "../types";

export class FeedbackNotFoundError extends Error {}
export class RetryNotAllowedError extends Error {}

export class FeedbackService {
  static createFeedback(content: string) {
    const now = new Date().toISOString();
    const row: FeedbackRow = {
      id: randomUUID(),
      content,
      status: "RECEIVED",
      created_at: now,
      updated_at: now,
      raw_ai_response: null,
      analysis_result: null,
      failure_reason: null,
    };

    FeedbackDao.insert(row);
    void AnalysisService.analyzeFeedback(row.id);

    return FeedbackService.toApiView(row);
  }

  static getFeedback(id: string) {
    const row = FeedbackDao.findById(id);
    if (!row) {
      throw new FeedbackNotFoundError(`Feedback ${id} not found`);
    }
    return FeedbackService.toApiView(row);
  }

  static listFeedback(options: FeedbackListOptions = {}) {
    return FeedbackDao.findAll(options).map(FeedbackService.toApiView);
  }

  static retryAnalysis(id: string) {
    const row = FeedbackDao.findById(id);
    if (!row) {
      throw new FeedbackNotFoundError(`Feedback ${id} not found`);
    }
    if (row.status !== "FAILED") {
      throw new RetryNotAllowedError(
        `Feedback ${id} is ${row.status}, only FAILED analyses can be retried`
      );
    }

    FeedbackDao.resetForRetry(id);
    void AnalysisService.analyzeFeedback(id);

    return FeedbackService.toApiView(FeedbackDao.findById(id)!);
  }

  private static toApiView(row: FeedbackRow) {
    return {
      id: row.id,
      content: row.content,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      analysis_result: row.analysis_result
        ? JSON.parse(row.analysis_result)
        : null,
      raw_ai_response: row.raw_ai_response,
      failure_reason: row.failure_reason,
    };
  }
}
