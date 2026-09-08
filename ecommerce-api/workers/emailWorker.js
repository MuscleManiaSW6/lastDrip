import EmailJob from "../models/EmailJob.js";
import { sendEmail } from "../services/emailServices.js";

const processEmailJobs = async () => {
  const job = await EmailJob.findOneAndUpdate(
    {
      status: "pending",
      nextAttemptAt: { $lte: new Date() },
    },
    {
      $set: {
        status: "processing",
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

    await job.save();
  } catch (err) {
    job.status = job.attempts >= 4 ? "failed" : "pending";

    job.lastError = err.message;

    if (job.status === "pending") {
      job.nextAttemptAt = new Date(Date.now() + 500 * 2 ** (job.attempts - 1));
    }

    await job.save();
  }
};

export { processEmailJobs };
