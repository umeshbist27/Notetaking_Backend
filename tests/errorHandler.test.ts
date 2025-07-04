import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from "express";
import errorHandler from "../middleware/errorHandler"
jest.setTimeout(240000);
describe("Global Error Handler Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock<any>;
  let jsonMock: jest.Mock;

  
  const createMockResponse = (): Partial<Response> => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockImplementation(() => {
      return { json: jsonMock } as unknown as Response;
    });
    return {
      status: statusMock,
    };
  };

  beforeEach(() => {
    req = {};
    res = createMockResponse();
    next = jest.fn();
  });

  it("should handle generic error with default 500 status", () => {
    const err = new Error("Something broke");

    errorHandler(err, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Something broke",
    });
  });

  it("should handle ValidationError with 400 status", () => {
    const err = {
      name: "ValidationError",
      message: "Validation failed",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Validation failed",
    });
  });

  it("should handle CastError with 400 status and custom message", () => {
    const err = {
      name: "CastError",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Invalid ID format.",
    });
  });

  it("should handle JsonWebTokenError with 401 status and session message", () => {
    const err = {
      name: "JsonWebTokenError",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Your session has expired or is invalid. Please log in again.",
    });
  });

  it("should handle TokenExpiredError with 401 status and session message", () => {
    const err = {
      name: "TokenExpiredError",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Your session has expired or is invalid. Please log in again.",
    });
  });

  it("should handle ECONNREFUSED error with 503 status and service unavailable message", () => {
    const err = {
      message: "connect ECONNREFUSED 127.0.0.1:27017",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Service unavailable. Please try again later.",
    });
  });

  it("should handle ENOTFOUND error with 503 status and service unavailable message", () => {
    const err = {
      message: "getaddrinfo ENOTFOUND database",
    };

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Service unavailable. Please try again later.",
    });
  });

  it("should fallback to default message if err.message is missing", () => {
    const err = {};

    errorHandler(err as any, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Something went wrong. Please try again later.",
    });
  });
});
