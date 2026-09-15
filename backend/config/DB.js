import mongoose from "mongoose";

import { env } from "./env.js";

const isTestEnvironment = Boolean(process.env.JEST_WORKER_ID);

const getDatabaseUri = () => {
  if (!isTestEnvironment) {
    return env.MONGODB_URI;
  }

  const testUri = env.MONGODB_TEST_URI;

  if (!testUri) {
    throw new Error("MONGODB_TEST_URI is required for tests.");
  }

  let parsedUri;

  try {
    parsedUri = new URL(testUri);
  } catch (err) {
    throw new Error("MONGODB_TEST_URI is not a valid MongoDB URI.");
  }

  const databaseName = parsedUri.pathname.replace(/^\/+/, "");

  if (databaseName !== "lastDrip_test") {
    throw new Error(
      "TEST_DATABASE_REQUIRED: Jest must connect to lastDrip_test.",
    );
  }

  return testUri;
};

const connectDB = async () => {
  try {
    const uri = getDatabaseUri();

    await mongoose.connect(uri);

    console.log(
      `MongoDB connected to ${
        isTestEnvironment ? "lastDrip_test" : "lastDrip"
      }`,
    );
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
