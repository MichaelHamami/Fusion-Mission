export type FeedbackStatus = "RECEIVED" | "ANALYZING" | "DONE" | "FAILED";

export interface Feedback {
  id: string;
  content: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}
