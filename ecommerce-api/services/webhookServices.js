import crypto from "crypto";

import { env } from "../config/env.js";

import Order from "../models/Orders.js";
import ProcessedWebhook from "../models/processedWebhook.js";

import {
  handlePaymentCaptured,
  handlePaymentFailed,
  handleRefundWebhook,
} from "./paymentServices.js";

//* Verify Razorpay Webhook
const verifyRazorpayWebhook = (rawBody, signature) => {
  const generatedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return generatedSignature === signature;
};

const supportedEvents = new Set([
  "payment.captured",
  "payment.failed",
  "refund.processed",
  "refund.failed",
]);

//* Currently processing Webhook
const claimWebhookEvent = async (eventId) => {
  try {
    return await ProcessedWebhook.create({
      eventId,
      provider: "razorpay",
      status: "processing",
    });
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
  }

  const existingEvent = await ProcessedWebhook.findOne({
    eventId,
    provider: "razorpay",
  });

  if (!existingEvent) {
    throw new Error("WEBHOOK_EVENT_CLAIM_FAILED");
  }

  if (existingEvent.status === "completed") {
    return null;
  }

  const staleProcessing =
    existingEvent.status === "processing" &&
    existingEvent.updatedAt < new Date(Date.now() - 5 * 60 * 1000);

  if (existingEvent.status === "processing" && !staleProcessing) {
    return null;
  }

  const claimedEvent = await ProcessedWebhook.findOneAndUpdate(
    {
      _id: existingEvent._id,
      $or: [
        { status: "failed" },
        {
          status: "processing",
          updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lastError: undefined,
      },
    },
    {
      returnDocument: "after",
    },
  );

  return claimedEvent;
};

//* Webhook Process
const processRazorpayWebhook = async (event) => {
  if (!supportedEvents.has(event.event)) {
    return;
  }

  const eventId = event.id;

  if (!eventId) {
    const err = new Error("WEBHOOK_EVENT_ID_MISSING");
    err.statusCode = 400;
    throw err;
  }

  const webhookEvent = await claimWebhookEvent(eventId);

  if (!webhookEvent) {
    return;
  }

  try {
    const payload = event.payload;

    if (event.event === "refund.processed" || event.event === "refund.failed") {
      await handleRefundWebhook(payload.refund.entity);
    } else {
      const payment = payload.payment.entity;

      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      const order = await Order.findOne({
        "payment.razorpayOrderId": razorpayOrderId,
      });

      if (!order) {
        const err = new Error("ORDER_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      if (event.event === "payment.failed") {
        await handlePaymentFailed(order);
      } else {
        await handlePaymentCaptured(order._id, razorpayPaymentId);
      }
    }

    webhookEvent.status = "completed";
    webhookEvent.processedAt = new Date();
    webhookEvent.lastError = undefined;

    await webhookEvent.save();
  } catch (err) {
    webhookEvent.status = "failed";
    webhookEvent.lastError = err.message;

    await webhookEvent.save();

    throw err;
  }
};

export { verifyRazorpayWebhook, processRazorpayWebhook };
