// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal server error";

  // AppError 인스턴스인 경우
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // 오류 처리
  console.error("Error :", err);

  const response = {
    success: false,
    error: message,
  };

  res.status(statusCode).json(response);
};
