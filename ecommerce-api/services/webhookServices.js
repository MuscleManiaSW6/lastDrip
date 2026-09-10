import crypto from "crypto";

import { env } from "../config/env.js";

import Order from "../models/Orders.js";
import ProcessedWebhook from "../models/processedWebhook.js";

import {
  handlePaymentCaptured,
  handlePaymentFailed,
} from "./paymentServices.js";

const verifyRazorpayWebhook = (rawBody, signature) => {
  const generatedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return generatedSignature === signature;
};

const processRazorpayWebhook = async (event) => {
  if (event.event !== "payment.captured" && event.event !== "payment.failed") {
    return;
  }

  const eventId = event.id;

  if (!eventId) {
    const err = new Error("WEBHOOK_EVENT_ID_MISSING");
    err.statusCode = 400;
    throw err;
  }

  let processedEvent;

  try {
    processedEvent = await ProcessedWebhook.findOneAndUpdate(
      {
        eventId,
        provider: "razorpay",
      },
      {
        $setOnInsert: {
          eventId,
          provider: "razorpay",
          processedAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "before",
      },
    );
  } catch (err) {
    if (err.code === 11000) {
      return;
    }

    throw err;
  }

  if (processedEvent) {
    return;
  }

  const payment = event.payload.payment.entity;

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
    return await handlePaymentFailed(order);
  }

  return await handlePaymentCaptured(order._id, razorpayPaymentId);
};

export { verifyRazorpayWebhook, processRazorpayWebhook };
