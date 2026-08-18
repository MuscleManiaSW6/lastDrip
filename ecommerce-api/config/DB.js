import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected to lastDrip");
  } catch (err) {
    console.error("MongoDB connection error", err);
    throw err;
  }
};

export default connectDB;
