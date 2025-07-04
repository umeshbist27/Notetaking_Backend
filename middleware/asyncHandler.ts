import { Request, Response, NextFunction } from "express";

const asyncHandler = <T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => (req: T, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
