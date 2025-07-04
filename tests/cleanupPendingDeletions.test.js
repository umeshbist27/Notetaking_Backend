import mongoose from "mongoose";
import Note from "../models/noteModel";
import PendingDeletion from "../models/pendingDeletionModel";
import { v2 as cloudinary } from "cloudinary";
import { MongoMemoryServer } from "mongodb-memory-server";
import { cleanupPendingDeletions, extractPublicId } from "../controllers/cleanUpController";
import { jest, describe, expect } from '@jest/globals';
jest.mock("cloudinary");
const mockDestroy = jest.fn();
cloudinary.uploader.destroy = mockDestroy;
let mongo;
jest.setTimeout(240000);
beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
});
afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
});
afterEach(async () => {
    await Note.deleteMany();
    await PendingDeletion.deleteMany();
    mockDestroy.mockReset();
});
describe("cleanupPendingDeletions", () => {
    it("should delete image from Cloudinary and remove entry from DB if not used", async () => {
        const imageUrl = "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg";
        const expectedPublicId = "sample";
        await PendingDeletion.create({ imageUrl, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) });
        await cleanupPendingDeletions();
        const deleted = await PendingDeletion.findOne({ imageUrl });
        expect(deleted).toBeNull();
        expect(mockDestroy).toHaveBeenCalledWith(expectedPublicId);
    });
    it("should not delete from Cloudinary if image is still used in notes", async () => {
        const imageUrl = "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg";
        const dummyUserId = new mongoose.Types.ObjectId();
        await Note.create({ title: "Test", content: imageUrl, userid: dummyUserId });
        await PendingDeletion.create({ imageUrl, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) });
        await cleanupPendingDeletions();
        const stillExists = await PendingDeletion.findOne({ imageUrl });
        expect(mockDestroy).not.toHaveBeenCalled();
    });
    it("should skip entries newer than one hour", async () => {
        const imageUrl = "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg";
        await PendingDeletion.create({ imageUrl, timestamp: new Date() });
        await cleanupPendingDeletions();
        const entry = await PendingDeletion.findOne({ imageUrl });
        expect(entry).not.toBeNull();
        expect(mockDestroy).not.toHaveBeenCalled();
    });
});
describe("extractPublicId", () => {
    it("should extract the correct publicId from a Cloudinary URL", () => {
        const url = "https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg";
        const result = extractPublicId(url);
        expect(result).toBe("sample");
    });
    it("should return empty string if pattern doesn't match", () => {
        const invalidUrl = "https://example.com/notcloudinary.jpg";
        const result = extractPublicId(invalidUrl);
        expect(result).toBe("");
    });
});
