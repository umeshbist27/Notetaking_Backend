import express, { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  getEmail,
  loginUser,
  postUserDetail,
} from "../controllers/userController.js";

const router:Router = express.Router();

router.post("/signup", asyncHandler(postUserDetail));

router.get("/check-email", asyncHandler(getEmail));

router.post("/login", asyncHandler(loginUser));

export default router;
