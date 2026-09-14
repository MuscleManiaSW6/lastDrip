import "dotenv/config";

import { env } from "./config/env.js";

import app from "./app.js";
import connectDB, { disconnectDB } from "./config/DB.js";

import { processEmailJobs } from "./workers/emailWorker.js";

const port = env.PORT;

let server;
let workerPromise;
let shuttingDown = false;

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const runEmailWorker = async () => {
  while (!shuttingDown) {
    try {
      await processEmailJobs();
    } catch (err) {
      console.error("Email worker error", err);
    }

    if (!shuttingDown) {
      await sleep(5000);
    }
  }
};

const gracefulShutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log("HTTP server closed");
          resolve();
        });
      });
    }

    if (workerPromise) {
      await workerPromise;
      console.log("Email worker stopped");
    }

    await disconnectDB();
  } catch (err) {
    console.error("Error during graceful shutdown", err);
    process.exit(1);
  }

  process.exit(0);
};

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(port, () => {
      console.log(`Server running at ${port}`);
    });

    workerPromise = runEmailWorker().catch((err) => {
      console.error("Email worker stopped unexpectedly", err);
    });
  } catch (err) {
    console.error("Server startup failed", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

startServer();
