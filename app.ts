import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import cron from "node-cron";
import { v2 as cloudinary } from "cloudinary";
import router from "./routes/authRoute.js";
import noteRoutes from "./routes/noteRoute.js";
import errorHandler from "./middleware/errorHandler.js";
import { cleanupPendingDeletions } from "./controllers/cleanUpController.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = process.env.MONGO_URL ; 

if (!mongoURI) {
  throw new Error("MONGO_URL is not defined in environment variables");
}

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("✓ Database connected successfully");
  })
  .catch((err) => {
    console.error("✗ Database connection error:", err);
    process.exit(1);
  });

app.use("/api/auth", router);
app.use("/api/notes", noteRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(` Server running on port ${port}`);
  const job = cron.schedule(
    "*/55 * * * *",
    async () => {
      await cleanupPendingDeletions();
    },
    {
      timezone: "UTC",
    }
  );

  job.start();
});
