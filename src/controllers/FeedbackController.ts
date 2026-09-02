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

const listFeedbackQuerySchema = z.object({
  status: z.enum(["RECEIVED", "ANALYZING", "DONE", "FAILED"]).optional(),
  pageNumber: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
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

  /** Filtering (?status=) and pagination (?pageNumber=&pageSize=) are optional per spec. */
  static list(req: Request, res: Response): Response {
    const parsed = listFeedbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    return res.json(FeedbackService.listFeedback(parsed.data));
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
