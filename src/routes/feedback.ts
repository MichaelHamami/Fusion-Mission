import { Router } from "express";
import { z } from "zod";
import { createFeedback, listFeedback } from "../repositories/feedbackRepository";

export const feedbackRouter = Router();

const createFeedbackSchema = z.object({
  content: z.string().trim().min(1, "content must not be empty").max(10_000),
});

feedbackRouter.post("/", (req, res) => {
  const parsed = createFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const feedback = createFeedback(parsed.data.content);
  return res.status(201).json(feedback);
});

feedbackRouter.get("/", (_req, res) => {
  return res.json(listFeedback());
});
