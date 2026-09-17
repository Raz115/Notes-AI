import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

/**
 * Express error-handling middleware (must have 4 args to be recognized as such).
 * Ensures failures (AI, DB, validation, etc.) return a clean JSON error
 * instead of leaking stack traces or crashing the server
 * (technical-requirements.md section 63).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", detail: message });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}
