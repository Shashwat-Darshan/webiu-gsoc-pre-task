import { createApp } from "../src/app";

const app = createApp();

export default function handler(req: unknown, res: unknown) {
  return app(req as never, res as never);
}
