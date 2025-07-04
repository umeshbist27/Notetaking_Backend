import express from "express";
import multer from "multer";
import verifyToken from "../middleware/verifyTokenHandler.js";
import { createNote, deleteNote, editNote, getNotes, uploadImage, } from "../controllers/noteController.js";
import asyncHandler from "../middleware/asyncHandler.js";
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    // fileFilter: (req, file, cb) => {
    //   if (file.mimetype.startsWith("image/")) {
    //     cb(null, true);
    //   } 
    // },
});
router.get("/note", verifyToken, asyncHandler(getNotes));
router.post("/create", verifyToken, upload.single("image"), asyncHandler(createNote));
router.put("/edit/:id", verifyToken, upload.single("image"), asyncHandler(editNote));
router.delete("/:id", verifyToken, asyncHandler(deleteNote));
router.post("/upload-image", verifyToken, upload.single("image"), asyncHandler(uploadImage));
export default router;
