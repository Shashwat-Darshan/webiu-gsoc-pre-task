import { Router } from "express";
import { analyzeRepositories } from "../controllers/analyze.controller";

const analyzeRouter = Router();

analyzeRouter.post("/analyze", analyzeRepositories);

export { analyzeRouter };
