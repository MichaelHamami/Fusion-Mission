import { Router } from "express";
import { FeedbackController } from "../controllers/FeedbackController";

export const feedbackRouter = Router();

feedbackRouter.post("/", FeedbackController.create);
feedbackRouter.get("/", FeedbackController.list);
feedbackRouter.get("/:id", FeedbackController.getOne);
feedbackRouter.post("/:id/retry", FeedbackController.retry);
