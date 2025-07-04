import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import asyncHandler from "./asyncHandler.js";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const verifyToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        const error = new Error("Unauthorized: Invalid or expired token");
        error.statusCode = 401;
        throw error;
    }
});
export default verifyToken;
