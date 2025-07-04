import mongoose, { Schema } from "mongoose";
const noteSchema = new Schema({
    title: { type: String, required: false, default: "" },
    content: { type: String, required: false, default: "" },
    imageUrl: { type: String, required: false, default: "" },
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {
    timestamps: true,
});
const Note = mongoose.model("Note", noteSchema);
export default Note;
