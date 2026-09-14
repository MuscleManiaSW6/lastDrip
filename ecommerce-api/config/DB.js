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

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();

    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("MongoDB disconnection error", err);
    throw err;
  }
};

export { disconnectDB };

export default connectDB;
