export type FeedbackStatus = "RECEIVED" | "ANALYZING" | "DONE" | "FAILED";

/** Row shape exactly as stored in SQLite (analysis_result is a raw JSON string). */
export interface FeedbackRow {
  id: string;
  content: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  raw_ai_response: string | null;
  analysis_result: string | null;
  failure_reason: string | null;
}
