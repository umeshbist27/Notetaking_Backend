import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/userModel.js";  
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface CustomError extends Error {
  statusCode?: number;
}


export const postUserDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existingUser: IUser | null = await User.findOne({ email });
    if (existingUser) {
      const error: CustomError = new Error("User already exist");
      error.statusCode = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      name: user.name
    });
  } catch (err) {
    next(err);
  }
};


export const getEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  
    const { email } = req.query;

    if (typeof email !== "string") {
      res.status(400).json({ exists: false, error: "Invalid email query" });
      return;
    }

    const user: IUser | null = await User.findOne({ email });

    res.json({ exists: !!user });
  
};


export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      const error: CustomError = new Error("User not found");
      error.statusCode = 400;
      throw error;
    }

    const userMatched = await bcrypt.compare(password, user.password);
    if (!userMatched) {
      const error: CustomError = new Error("Password not matched");
      error.statusCode = 400;
      throw error;
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET as string, 
      { expiresIn: "5h" }
    );

    res.json({
      token,
      name: user.name
    });
  } catch (err) {
    next(err);
  }
};

