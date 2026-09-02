import { Router } from "express";
import { FeedbackController } from "../controllers/FeedbackController";

export const feedbackRouter = Router();

feedbackRouter.post("/", FeedbackController.create);
feedbackRouter.get("/", FeedbackController.get);
feedbackRouter.get("/:id", FeedbackController.getById);
feedbackRouter.post("/:id/retry", FeedbackController.retry);
