import { Request, Response, NextFunction } from "express";

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode: number = err.statusCode || 500;
  let message: string =
    err.message || "Something went wrong. Please try again later.";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format.";
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your session has expired or is invalid. Please log in again.";
  }

  if (
    err.message?.includes("ECONNREFUSED") ||
    err.message?.includes("ENOTFOUND")
  ) {
    statusCode = 503;
    message = "Service unavailable. Please try again later.";
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

export default errorHandler;
