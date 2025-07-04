import mongoose, { Document, Schema, Model } from "mongoose";

export interface INote extends Document {
  title: string;
  content: string;
  imageUrl?: string;
  userid: mongoose.Types.ObjectId;
}

const noteSchema: Schema<INote> = new Schema(
  {
    title: { type: String, required: false, default: "" },
    content: { type: String, required: false, default: "" },
    imageUrl: { type: String, required: false, default: "" },
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Note: Model<INote> = mongoose.model<INote>("Note", noteSchema);

export default Note;