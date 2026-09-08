import mongoose from "mongoose";

const emailJobSchema = mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },

    html: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    attempts: {
      type: Number,
      default: 0,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    lockedAt: {
      type: String,
    },

    lastError: {
      type: Date,
    },
  },

  {
    timestamps: true,
  },
);

const EmailJob = mongoose.model("EmailJob", emailJobSchema);

export default EmailJob;
