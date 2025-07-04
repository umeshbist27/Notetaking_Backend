import { v2 as cloudinary } from "cloudinary";
import Note from "../models/noteModel.js";
import PendingDeletion from "../models/pendingDeletionModel.js";

const extractPublicId = (url: string): string => {
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\./);
  return matches ? matches[1] : "";
};

export const cleanupPendingDeletions = async (): Promise<void> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const candidates = await PendingDeletion.find({
    timestamp: { $lt: oneHourAgo },
  });

  for (const entry of candidates) {
    const stillUsed = await Note.exists({
      $or: [
        { content: { $regex: entry.imageUrl } },
        { imageUrl: entry.imageUrl },
      ],
    });

    if (!stillUsed) {
      const publicId = extractPublicId(entry.imageUrl);

      await cloudinary.uploader.destroy(publicId);
      await entry.deleteOne();
    } else {
      await entry.deleteOne();
    }
  }
};
export {extractPublicId};