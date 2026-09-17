import express, { type Express } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

/**
 * Builds the Express application without starting a listener.
 *
 * Keeping app construction separate from `app.listen(...)` lets integration
 * tests exercise routes via supertest without binding a real port, and keeps
 * the "Application API" box in the architecture diagram
 * (technical-requirements.md section 5) as one cohesive, testable unit.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );
  app.use(express.json({ limit: "5mb" }));

  app.use(healthRouter);

  // Future routers land here as phases progress:
  //   Phase 6: /auth, /notebooks, /pages, /objects
  //   Phase 8: /ai/answer
  //   Phase 9: /ai/draw
  //   Phase 10: /ai/graph

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
