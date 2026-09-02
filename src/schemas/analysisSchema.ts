import { z } from "zod";

export const AnalysisResultSchema = z
  .object({
    sentiment: z.enum(["positive", "neutral", "negative"]),
    feature_requests: z.array(
      z.object({
        title: z.string().trim().min(1),
        confidence: z.number().min(0).max(1),
      })
    ),
    actionable_insight: z.string().trim().min(1),
  })
  .strict();

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
