import { Request, Response } from "express";
import { z } from "zod";
import {
  FeedbackService,
  FeedbackNotFoundError,
  RetryNotAllowedError,
} from "../services/FeedbackService";

const createFeedbackSchema = z.object({
  content: z.string().trim().min(1, "content must not be empty").max(10_000),
});

export class FeedbackController {
  static create(req: Request, res: Response): Response {
    const parsed = createFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const feedback = FeedbackService.createFeedback(parsed.data.content);
    return res.status(201).json(feedback);
  }

  static list(_req: Request, res: Response): Response {
    return res.json(FeedbackService.listFeedback());
  }

  static getOne(req: Request, res: Response): Response {
    try {
      return res.json(FeedbackService.getFeedback(req.params.id));
    } catch (error) {
      if (error instanceof FeedbackNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static retry(req: Request, res: Response): Response {
    try {
      return res.json(FeedbackService.retryAnalysis(req.params.id));
    } catch (error) {
      if (error instanceof FeedbackNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof RetryNotAllowedError) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  }
}
