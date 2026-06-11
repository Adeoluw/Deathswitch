import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  logger.error({ err }, "Unhandled error");
  res.status(statusCode).json({
    success: false,
    error: err.message ?? "Internal Server Error",
  });
}
