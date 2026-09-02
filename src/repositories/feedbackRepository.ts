import { randomUUID } from "node:crypto";
import { db } from "../db";
import { Feedback } from "../types";

export function createFeedback(content: string): Feedback {
  const now = new Date().toISOString();
  const feedback: Feedback = {
    id: randomUUID(),
    content,
    status: "RECEIVED",
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO feedback (id, content, status, created_at, updated_at)
     VALUES (@id, @content, @status, @created_at, @updated_at)`
  ).run(feedback);

  return feedback;
}

export function getFeedbackById(id: string): Feedback | undefined {
  return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id) as
    | Feedback
    | undefined;
}

export function listFeedback(): Feedback[] {
  return db
    .prepare(`SELECT * FROM feedback ORDER BY created_at DESC`)
    .all() as Feedback[];
}
