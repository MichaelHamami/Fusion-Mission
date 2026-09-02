import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export class AiRequestError extends Error {}

const SYSTEM_PROMPT = `You analyze a single piece of user product feedback.

Respond with ONLY a strict JSON object, no markdown fences, no commentary, no
text before or after it, matching exactly this shape:

{
  "sentiment": "positive" | "neutral" | "negative",
  "feature_requests": [ { "title": string, "confidence": number between 0 and 1 } ],
  "actionable_insight": string
}

Rules:
- "sentiment" must be exactly one of: positive, neutral, negative.
- "feature_requests" is an array, and may be empty if the feedback contains
  no identifiable feature request.
- "confidence" is a number between 0.0 and 1.0.
- "actionable_insight" is one short, concrete sentence a product team could
  act on.
- Output must be valid JSON with no additional keys.`;

export class AnalysisDao {
  /**
   * Raw call to the LLM. Deliberately does no JSON parsing or schema
   * validation - that is AnalysisService's job, so it can tell "the API
   * call itself failed" apart from "the model returned malformed output".
   */
  static async requestAnalysis(content: string): Promise<string> {
    try {
      const response = await client.messages.create({
        model: config.analysisModel,
        max_tokens: 1024,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (!textBlock) {
        throw new AiRequestError("AI response contained no text block");
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AiRequestError) {
        throw error;
      }
      if (error instanceof Anthropic.APIError) {
        throw new AiRequestError(`Anthropic API error: ${error.message}`);
      }
      throw new AiRequestError(
        `Unexpected error calling Anthropic API: ${(error as Error).message}`
      );
    }
  }
}
