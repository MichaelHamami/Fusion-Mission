import { db } from "../db";
import { FeedbackRow, FeedbackStatus } from "../types";

export class FeedbackDao {
  static insert(row: {
    id: string;
    content: string;
    status: FeedbackStatus;
    created_at: string;
    updated_at: string;
  }): void {
    db.prepare(
      `INSERT INTO feedback (id, content, status, created_at, updated_at)
       VALUES (@id, @content, @status, @created_at, @updated_at)`
    ).run(row);
  }

  static findById(id: string): FeedbackRow | undefined {
    return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id) as
      | FeedbackRow
      | undefined;
  }

  static findAll(): FeedbackRow[] {
    return db
      .prepare(`SELECT * FROM feedback ORDER BY created_at DESC`)
      .all() as FeedbackRow[];
  }

  static updateStatus(id: string, status: FeedbackStatus): void {
    db.prepare(
      `UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, new Date().toISOString(), id);
  }

  static saveAnalysisSuccess(
    id: string,
    rawAiResponse: string,
    analysisResultJson: string
  ): void {
    db.prepare(
      `UPDATE feedback
       SET status = 'DONE',
           raw_ai_response = ?,
           analysis_result = ?,
           failure_reason = NULL,
           updated_at = ?
       WHERE id = ?`
    ).run(rawAiResponse, analysisResultJson, new Date().toISOString(), id);
  }

  static saveAnalysisFailure(
    id: string,
    failureReason: string,
    rawAiResponse: string | null
  ): void {
    db.prepare(
      `UPDATE feedback
       SET status = 'FAILED',
           failure_reason = ?,
           raw_ai_response = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(failureReason, rawAiResponse, new Date().toISOString(), id);
  }

  static resetForRetry(id: string): void {
    db.prepare(
      `UPDATE feedback
       SET status = 'RECEIVED',
           failure_reason = NULL,
           updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), id);
  }
}
