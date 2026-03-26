import cors from "cors";
import express from "express";
import { analyzeRouter } from "./routes/analyze.route";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(analyzeRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
  });

  return app;
}
