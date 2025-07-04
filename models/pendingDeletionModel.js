import mongoose from "mongoose";
const pendingDeletionSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true, unique: true },
    timestamp: { type: Date, default: Date.now },
});
export default mongoose.model("PendingDeletion", pendingDeletionSchema);
