const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
  );
}

export const config = {
  anthropicApiKey: ANTHROPIC_API_KEY,
  analysisModel: process.env.ANALYSIS_MODEL ?? "claude-haiku-4-5-20251001",
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
};
