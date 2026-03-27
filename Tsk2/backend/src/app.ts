import cors from "cors";
import express from "express";
import { analyzeRouter } from "./routes/analyze.route";

export function createApp(): express.Express {
  const app = express();

  // Configure CORS to allow both localhost (dev) and production frontend domains
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://frontend-six-inky-50.vercel.app",
        "https://frontend-seven-inky-50.vercel.app"
      ],
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true
    })
  );
  app.use(express.json());
  app.use(analyzeRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
  });

  return app;
}
