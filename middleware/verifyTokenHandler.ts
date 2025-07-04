import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import asyncHandler from "./asyncHandler.js";  

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

interface AuthPayload extends JwtPayload {
  id: string;
}

interface AuthRequest extends Request {
  user?: AuthPayload;
}

const verifyToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error: any = new Error("Unauthorized: No token provided");
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      req.user = decoded;
      next();
    } catch (err: any) {
      const error: any = new Error("Unauthorized: Invalid or expired token");
      error.statusCode = 401;
      throw error;
    }
  }
);

export default verifyToken;
