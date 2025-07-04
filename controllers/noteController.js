import Note from "../models/noteModel.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import PendingDeletion from "../models/pendingDeletionModel.js";
import { extractImageUrls } from "./extractImageUrls.js";
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            upload_preset: "noteTaking_app",
            resource_type: "image",
        }, (error, result) => {
            if (result) {
                resolve(result.secure_url);
            }
            else {
                reject(error);
            }
        });
        streamifier.createReadStream(buffer).pipe(stream);
    });
};
const extractPublicId = (url) => {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : "";
};
export const getNotes = async (req, res) => {
    if (!req.user) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    const notes = await Note.find({ userid: req.user.id });
    res.json(notes);
};
export const createNote = async (req, res) => {
    if (!req.user) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    const { title, content } = req.body;
    let imageUrl = "";
    if (req.file) {
        try {
            imageUrl = await uploadToCloudinary(req.file.buffer);
        }
        catch (error) {
            const err = error;
            const customError = new Error(`Image upload failed`);
            customError.statusCode = 500;
            throw customError;
        }
    }
    const note = await Note.create({
        title: title?.trim(),
        content: content?.trim(),
        imageUrl,
        userid: req.user.id,
    });
    res.status(201).json(note);
};
export const editNote = async (req, res) => {
    if (!req.user) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    const noteId = req.params.id;
    const updateData = { ...req.body };
    const oldNote = await Note.findById(noteId);
    if (!oldNote) {
        const error = new Error("Note not found");
        error.statusCode = 404;
        throw error;
    }
    if (req.file) {
        try {
            const imageUrl = await uploadToCloudinary(req.file.buffer);
            updateData.imageUrl = imageUrl;
        }
        catch (error) {
            const err = error;
            const customError = new Error(`Image upload failed`);
            customError.statusCode = 500;
            throw customError;
        }
    }
    const updatedNote = await Note.findByIdAndUpdate(noteId, updateData, {
        new: true,
    });
    if (!updatedNote) {
        const error = new Error("Failed to update note");
        error.statusCode = 500;
        throw error;
    }
    const oldImageUrls = extractImageUrls(oldNote.content);
    const newImageUrls = extractImageUrls(updateData.content);
    const unusedImages = oldImageUrls.filter((url) => !newImageUrls.includes(url));
    if (oldNote.imageUrl &&
        updateData.imageUrl &&
        oldNote.imageUrl !== updateData.imageUrl) {
        unusedImages.push(oldNote.imageUrl);
    }
    for (const url of unusedImages) {
        const exists = await PendingDeletion.exists({ imageUrl: url });
        if (!exists) {
            await PendingDeletion.create({ imageUrl: url, timestamp: new Date() });
        }
    }
    res.status(200).json({
        message: "Note updated successfully",
        note: updatedNote,
        markedForDeletion: unusedImages.length,
    });
};
export const deleteNote = async (req, res) => {
    if (!req.user) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    const note = await Note.findById(req.params.id);
    if (!note) {
        const error = new Error("Note not found");
        error.statusCode = 404;
        throw error;
    }
    const urls = [
        ...(note.content.match(/<img[^>]+src="([^"]*cloudinary[^"]*)"/g) || [])
            .map((m) => m.match(/src="([^"]*)"/)?.[1])
            .filter(Boolean),
        ...(note.imageUrl?.includes("cloudinary") ? [note.imageUrl] : []),
    ];
    await Note.findByIdAndDelete(req.params.id);
    const validUrls = urls.filter((u) => typeof u === "string");
    await Promise.all(validUrls.map(async (url) => {
        const publicId = extractPublicId(url);
        if (publicId) {
            try {
                await cloudinary.uploader.destroy(publicId);
            }
            catch (err) {
                console.error("Failed to delete image:");
            }
        }
    }));
    res.status(200).json({
        message: "Note and its images deleted successfully",
        deletedImages: urls.length,
    });
};
export const uploadImage = async (req, res, next) => {
    if (!req.user) {
        const error = new Error("Unauthorized: No token provided");
        error.statusCode = 401;
        throw error;
    }
    if (!req.file) {
        const error = new Error("No image file provided");
        error.statusCode = 400;
        throw error;
    }
    try {
        const imageUrl = await uploadToCloudinary(req.file.buffer);
        res.status(200).json({
            success: true,
            imageUrl,
            message: "Image uploaded successfully",
        });
    }
    catch (error) {
        const err = error;
        const customError = new Error(`Image upload failed: ${err.message}`);
        customError.statusCode = 500;
        throw customError;
    }
};
export { uploadToCloudinary, extractPublicId };
