import mongoose from "mongoose";

import { env } from "./env.js";

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);

    console.log("MongoDB connected to lastDrip");
  } catch (err) {
    console.error("MongoDB connection error", err);
    throw err;
  }
};

export default connectDB;
