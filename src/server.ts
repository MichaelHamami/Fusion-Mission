import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

const app = createApp();

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
