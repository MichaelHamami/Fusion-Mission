import express, { NextFunction, Request, Response } from "express";
import { feedbackRouter } from "./routes/feedback";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/feedback", feedbackRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error while handling request:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
