import mongoose from "mongoose";
import supertest from "supertest";
import testApp from "./testApp";
import PendingDeletion from "../models/pendingDeletionModel";
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadResponseCallback,
} from "cloudinary";
import { MongoMemoryServer } from "mongodb-memory-server";
import { fileURLToPath } from "url";
import path from "path";
import { PassThrough } from "stream";
import { jest } from "@jest/globals";
import {
  createNote,
  deleteNote,
  editNote,
  extractPublicId,
  getNotes,
  uploadImage,
} from "../controllers/noteController";

import { extractImageUrls } from "../controllers/extractImageUrls";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
jest.setTimeout(250000);
let mongo: MongoMemoryServer;
let token: string;
let noteId: string;

const request = supertest(testApp);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);

  const user = {
    name: "Test User",
    email: "testuser@example.com",
    password: "123456",
  };

  await request.post("/api/auth/signup").send(user);
  const loginRes = await request.post("/api/auth/login").send({
    email: user.email,
    password: user.password,
  });

  if (!loginRes.body.token) throw new Error("Login failed");
  token = loginRes.body.token;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongo.stop();
});

// CREATE ----------------------

describe("Notes - Create", () => {
  it("should create a note successfully", async () => {
    const title = "Test Note";
    const content = "This is a test note";

    const res = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: title.trim(),
        content: content.trim(),
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.title).toBe("Test Note");
    noteId = res.body._id;
  });

  test("create Note throws if req.user is missing", async () => {
    const req = { user: undefined, params: { id: "someId" } } as any;
    const res = {} as any;

    await expect(createNote(req, res)).rejects.toThrow(
      "Unauthorized: No token provided"
    );
  });

  it("should trim title and content when creating a note", async () => {
    const res = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "   Trimmed Title   ", content: "   Trimmed Content   " });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Trimmed Title");
    expect(res.body.content).toBe("Trimmed Content");
  });

  it("should return 201 when image upload succeeds", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(undefined, {
          secure_url: "https://cloudinary.com/fake.jpg",
        } as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const res = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Note with image")
      .field("content", "has image");

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toBe("https://cloudinary.com/fake.jpg");
  });

  it("should return 500 and message 'Image upload failed' if upload fails", async () => {
    const fakeCloudinaryError = {
      http_code: 500,
      message: "Mock Cloudinary error",
      name: "UploadApiErrorResponse",
    };

    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(fakeCloudinaryError as any, undefined as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const res = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Test Title")
      .field("content", "Test Content");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Image upload failed");
  });

  it("should detect removed images from HTML content", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Image Note",
        content: `<img src="https://res.cloudinary.com/demo/image/upload/v123/sample1.jpg" />`,
      });

    const id = createRes.body._id;

    const res = await request
      .put(`/api/auth/notes/edit/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        content: `No image now`,
        title: "Clean",
      });

    expect(res.status).toBe(200);
    expect(res.body.markedForDeletion).toBeGreaterThanOrEqual(1);
  });

  it("should include imageUrl in deletion if it's a Cloudinary URL", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementationOnce(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(undefined, {
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/v123/testimg.jpg",
        } as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Image Note")
      .field("content", "Test content");

    const id = createRes.body._id;

    const spy = jest
      .spyOn(cloudinary.uploader, "destroy")
      .mockResolvedValue({} as any);

    const delRes = await request
      .delete(`/api/auth/notes/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });
});

// GET ----------------------

describe("Notes - Read", () => {
  it("should fetch all notes for the user", async () => {
    const res = await request
      .get("/api/auth/notes/note")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("fetch Note throws if req.user is missing", async () => {
    const req = { user: undefined, params: { id: "someId" } } as any;
    const res = {} as any;

    await expect(getNotes(req, res)).rejects.toThrow(
      "Unauthorized: No token provided"
    );
  });

  it("should return 401 for invalid token", async () => {
    const res = await request
      .get("/api/auth/notes/note")
      .set("Authorization", "Bearer invalid.token");

    expect(res.status).toBe(401);
  });

  it("should return 500 for DB crash", async () => {
    jest.spyOn(mongoose.Model, "find").mockRejectedValue(new Error("DB fail"));

    const res = await request
      .get("/api/auth/notes/note")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});

//  EDIT ----------------------

describe("Notes - Update", () => {
  it("should update the note successfully", async () => {
    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Note", content: "Updated content" });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe("Updated Note");
  });

  test("update Note throws if req.user is missing", async () => {
    const req = { user: undefined, params: { id: "someId" } } as any;
    const res = {} as any;

    await expect(editNote(req, res)).rejects.toThrow(
      "Unauthorized: No token provided"
    );
  });

  it("should return 404 if note does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request
      .put(`/api/auth/notes/edit/${fakeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Nonexistent", content: "Should fail" });

    expect(res.status).toBe(404);
  });

  it("should upload image successfully", async () => {
    const res = await request
      .post("/api/auth/notes/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", "tests/sample.jpg");

    expect(res.status).toBe(200);
  });

  it("should return 500 if Cloudinary upload fails", async () => {
    const res = await request
      .post("/api/auth/notes/upload-image")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("should fail update note without token", async () => {
    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .send({ title: "x" });
    expect(res.status).toBe(401);
  });

  it("should mark old images for deletion on update", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test",
        content: `<img src="https://res.cloudinary.com/demo/image/upload/v123/sample.jpg">`,
      });

    const newNoteId = createRes.body._id;

    const res = await request
      .put(`/api/auth/notes/edit/${newNoteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated", content: "No image" });

    expect(res.status).toBe(200);
    expect(res.body.markedForDeletion).toBeGreaterThanOrEqual(1);
  });

  it("should mark old imageUrl for deletion when a new one is uploaded", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementationOnce(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(undefined, {
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/v123/oldmain.jpg",
        } as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Initial")
      .field("content", "abc");

    const noteId = createRes.body._id;

    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementationOnce(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(undefined, {
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/v123/newmain.jpg",
        } as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Updated")
      .field("content", "still abc");

    expect(res.status).toBe(200);
    expect(res.body.markedForDeletion).toBeGreaterThanOrEqual(1);
  });

  it("should return 500 if note update fails internally", async () => {
    const fakeNoteId = new mongoose.Types.ObjectId().toString();

    jest.spyOn(mongoose.Model, "findById").mockResolvedValue({
      _id: fakeNoteId,
      title: "Old",
      content: "Old",
      imageUrl: "",
    });
    jest.spyOn(mongoose.Model, "findByIdAndUpdate").mockResolvedValue(null);

    const res = await request
      .put(`/api/auth/notes/edit/${fakeNoteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should fail" });

    expect(res.status).toBe(500);
  });

  it("should handle PendingDeletion.exists throwing error", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test",
        content: `<img src="https://res.cloudinary.com/demo/image/upload/v123/sample.jpg">`,
      });

    const noteId = createRes.body._id;

    jest
      .spyOn(mongoose.Model, "exists")
      .mockRejectedValueOnce(new Error("DB fail"));

    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated", content: "No image" });

    expect(res.status).toBe(500);
  });

  it("should not mark old image if new imageUrl same as old", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Same Img", content: "abc" });

    const id = createRes.body._id;

    await mongoose.model("Note").findByIdAndUpdate(id, {
      imageUrl: "https://res.cloudinary.com/demo/image/upload/v123/image.jpg",
    });

    const res = await request
      .put(`/api/auth/notes/edit/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        content: "updated",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/v123/image.jpg",
      });

    expect(res.status).toBe(200);
    expect(res.body.markedForDeletion).toBe(0);
  });
  it("should skip PendingDeletion.create if already exists", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "To Edit",
        content: `<img src="https://res.cloudinary.com/demo/image/upload/v123/test.jpg">`,
      });

    const noteId = createRes.body._id;

    jest.spyOn(PendingDeletion, "exists").mockReturnValue({
      exec: () => Promise.resolve(true),
    } as any);

    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Now no images" });

    expect(res.status).toBe(200);
  });

  it("should update note successfully with image upload in editNote", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(undefined, {
          secure_url: "https://cloudinary.com/fake-edit.jpg",
        } as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Original Title", content: "Original Content" });

    expect(createRes.status).toBe(201);
    const noteId = createRes.body._id;

    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Updated Title")
      .field("content", "Updated Content");

    expect(res.status).toBe(200);
    expect(res.body.note.imageUrl).toBe("https://cloudinary.com/fake-edit.jpg");
  });

  it("should return 500 and message 'Image upload failed' if editNote image upload fails", async () => {
    const fakeCloudinaryError = {
      http_code: 500,
      message: "Mock Cloudinary error",
      name: "UploadApiErrorResponse",
    };

    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() =>
        callback(fakeCloudinaryError as any, undefined as any)
      );
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Note to fail", content: "Original" });

    expect(createRes.status).toBe(201);
    const noteId = createRes.body._id;

    const res = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"))
      .field("title", "Failing Update")
      .field("content", "Failing Content");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Image upload failed");
  });

  it("should cover extractImageUrls diff logic in editNote", async () => {
    const imageUrl =
      "https://res.cloudinary.com/demo/image/upload/v123/coverme.jpg";

    // Create note with content that includes <img>
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "With Img",
        content: `<p>Photo: <img src="${imageUrl}" /></p>`,
      });

    const noteId = createRes.body._id;
    expect(createRes.status).toBe(201);

    // Update with content that removes <img>
    const updateRes = await request
      .put(`/api/auth/notes/edit/${noteId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Updated",
        content: "<p>No image here</p>", // Removed <img>
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.markedForDeletion).toBe(1); // proves difference detected
  });
});

// DELETE ----------------------

describe("Notes - Delete", () => {
  it("should delete the note successfully", async () => {
    const res = await request
      .delete(`/api/auth/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("should return 404 for non-existent note", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request
      .delete(`/api/auth/notes/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test("deleteNote throws if req.user is missing", async () => {
    const req = { user: undefined, params: { id: "someId" } } as any;
    const res = {} as any;

    await expect(deleteNote(req, res)).rejects.toThrow(
      "Unauthorized: No token provided"
    );
  });

  it("should handle cloudinary destroy error gracefully", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Note with image",
        content: `<img src="https://res.cloudinary.com/demo/image/upload/v123/willfail.jpg">`,
      });

    const id = createRes.body._id;

    jest
      .spyOn(cloudinary.uploader, "destroy")
      .mockRejectedValueOnce(new Error("Cloudinary fail"));

    const res = await request
      .delete(`/api/auth/notes/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("should not call destroy if extractPublicId returns empty", async () => {
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Skip destroy",
        content: `<img src="https://example.com/no-match.jpg" />`,
      });

    const spy = jest.spyOn(cloudinary.uploader, "destroy");

    const res = await request
      .delete(`/api/auth/notes/${createRes.body._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });
  it("should handle extractPublicId returning empty string", async () => {
    const htmlContent = `<img src="https://some.noncloudinary.url/image.jpg">`;
    const createRes = await request
      .post("/api/auth/notes/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Invalid Public ID", content: htmlContent });

    const noteId = createRes.body._id;

    const res = await request
      .delete(`/api/auth/notes/${noteId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// UPLOAD IMAGE ----------------------

describe("Notes - Upload Image", () => {
  test("update image throws if req.user is missing", async () => {
    const req = { user: undefined, params: { id: "someId" } } as any;
    const res = {} as any;
    const next = jest.fn();

    await expect(uploadImage(req, res, next)).rejects.toThrow(
      "Unauthorized: No token provided"
    );
  });

  it("should fail when no image is provided", async () => {
    const res = await request
      .post("/api/auth/notes/upload-image")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
  it("should handle uploadToCloudinary throwing non-Error value", async () => {
    jest.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
      options: UploadApiOptions,
      callback: UploadResponseCallback
    ) => {
      const stream = new PassThrough();
      process.nextTick(() => callback("Non-Error Failure" as any));
      return stream;
    }) as typeof cloudinary.uploader.upload_stream);

    const res = await request
      .post("/api/auth/notes/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", path.join(__dirname, "sample.jpg"));

    expect(res.status).toBe(500);
  });
});

describe("Notes - Helper to extractPublic id", () => {
  it("should extract public ID correctly and fallback to empty string", () => {
    expect(
      extractPublicId(
        "https://res.cloudinary.com/demo/image/upload/v123/abc.jpg"
      )
    ).toBe("abc");

    expect(extractPublicId("https://example.com/no-match")).toBe("");
  });
});
describe("extractImageUrls", () => {
  it("should extract a single image URL", () => {
    const html = `<img src="https://example.com/image1.jpg" />`;
    const result = extractImageUrls(html);
    expect(result).toEqual(["https://example.com/image1.jpg"]);
  });

  it("should extract multiple image URLs", () => {
    const html = `
      <p>Images below</p>
      <img src="https://cdn.site.com/img1.png" />
      <img src="https://cdn.site.com/img2.jpg" />
    `;
    const result = extractImageUrls(html);
    expect(result).toEqual([
      "https://cdn.site.com/img1.png",
      "https://cdn.site.com/img2.jpg",
    ]);
  });

  it("should return empty array if no <img> tags are present", () => {
    const html = `<p>No images here</p>`;
    const result = extractImageUrls(html);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty input", () => {
    const result = extractImageUrls("");
    expect(result).toEqual([]);
  });

  it("should skip malformed <img> tags or ones without src", () => {
    const html = `
      <img>
      <img src='broken.jpg'>
      <img src="https://valid.com/ok.jpg" />
    `;
    const result = extractImageUrls(html);
    expect(result).toEqual(["https://valid.com/ok.jpg"]);
  });

  it("should handle <img> tags with multiple attributes", () => {
    const html = `<img class="image" src="https://site.com/attr.jpg" width="500" alt="desc"/>`;
    const result = extractImageUrls(html);
    expect(result).toEqual(["https://site.com/attr.jpg"]);
  });

  it('should return [] if there is no matching <img src="..."> tag', () => {
    const html = `<img alt="no src" /><p>Text</p>`;
    const result = extractImageUrls(html);
    expect(result).toEqual([]);
  });

  it("should extract old and new image URLs from content", () => {
    const oldNote = {
      content: `<img src="https://cloud.com/img1.jpg" /><p>Old content</p>`,
    };
    const updateData = {
      content: `<img src="https://cloud.com/img2.jpg" />`,
    };

    const oldImageUrls = extractImageUrls(oldNote.content);
    const newImageUrls = extractImageUrls(updateData.content || "");

    expect(oldImageUrls).toEqual(["https://cloud.com/img1.jpg"]);
    expect(newImageUrls).toEqual(["https://cloud.com/img2.jpg"]);
  });

  it("should hit the `|| []` fallback when match returns null", () => {
    const html = `<div><strong>No image src here</strong></div>`;
    const result = extractImageUrls(html);
    expect(result).toEqual([]);
  });

  it("should default to empty string when updateData.content is undefined", () => {
    const updateData = {} as { content?: string };
    const result = extractImageUrls(updateData.content || "");
    expect(result).toEqual([]);
  });
});
