import EmailJob from "../models/EmailJob.js";
import { sendEmail } from "../services/emailServices.js";

const EMAIL_JOB_STALE_TIME = 5 * 60 * 1000;

const processEmailJobs = async () => {
  const staleTime = new Date(Date.now() - EMAIL_JOB_STALE_TIME);

  const job = await EmailJob.findOneAndUpdate(
    {
      $or: [
        {
          status: "pending",
          nextAttemptAt: { $lte: new Date() },
        },
        {
          status: "processing",
          lockedAt: { $lt: staleTime },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedAt: new Date(),
      },

      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!job) {
    return;
  }

  try {
    await sendEmail(job.to, job.subject, job.html);

    job.status = "completed";
    job.lockedAt = undefined;

    await job.save();
  } catch (err) {
    job.status = job.attempts >= 4 ? "failed" : "pending";

    job.lastError = err.message;
    job.lockedAt = undefined;

    if (job.status === "pending") {
      job.nextAttemptAt = new Date(Date.now() + 500 * 2 ** (job.attempts - 1));
    }

    await job.save();
  }
};

export { processEmailJobs };
