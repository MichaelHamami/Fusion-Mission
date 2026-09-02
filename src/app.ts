import express from "express";
import { feedbackRouter } from "./routes/feedback";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/feedback", feedbackRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
