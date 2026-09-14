import mongoose from "mongoose";

const processedWebhookSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
    },

    provider: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },

    processedAt: {
      type: Date,
    },

    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

processedWebhookSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const ProcessedWebhook = mongoose.model(
  "ProcessedWebhook",
  processedWebhookSchema,
);

export default ProcessedWebhook;
