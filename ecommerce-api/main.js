import "dotenv/config";

import { env } from "./config/env.js";

import app from "./app.js";
import connectDB from "./config/DB.js";

import { processEmailJobs } from "./workers/emailWorker.js";

const port = env.PORT;

const runEmailWorker = async () => {
  while (true) {
    try {
      await processEmailJobs();
    } catch (err) {
      console.error("Email worker error", err);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Server running at ${port}`);
    });

    runEmailWorker();
  } catch (err) {
    console.log(err);
  }
};

startServer();
