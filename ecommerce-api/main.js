import "dotenv/config";

import { env } from "./config/env.js";

import app from "./app.js";
import connectDB from "./config/DB.js";

import { processEmailJobs } from "./workers/emailWorker.js";

const port = env.PORT;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Server running at ${port}`);
    });

    setInterval(() => {
      processEmailJobs().catch((err) => {
        console.error("Email worker error", err);
      });
    }, 5000);
  } catch (err) {
    console.log(err);
  }
};

startServer();
