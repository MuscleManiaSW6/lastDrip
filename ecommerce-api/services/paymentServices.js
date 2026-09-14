import crypto from "crypto";
import mongoose from "mongoose";

import { env } from "../config/env.js";

import Product from "../models/Product.js";
import Order from "../models/Orders.js";
import razorpay from "../config/razorpay.js";
import {
  orderConfirmationEmail,
  paymentFailureEmail,
  queueEmail,
} from "./emailServices.js";

//* Razorpay Order creation
const createRazorpayOrder = async (amount, receipt) => {
  return await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: receipt,
  });
};

//* POST(/:id/payment/verify)
const verifyRazorpayPayment = async (
  orderId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
) => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    const error = new Error("ORDER_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const storedRazorpayOrderId = order.payment.razorpayOrderId;

  if (!storedRazorpayOrderId) {
    const error = new Error("RAZORPAY_ORDER_NOT_FOUND");
    error.statusCode = 400;
    throw error;
  }

  if (storedRazorpayOrderId !== razorpayOrderId) {
    const error = new Error("RAZORPAY_ORDER_MISMATCH");
    error.statusCode = 400;
    throw error;
  }

  const body = `${storedRazorpayOrderId}|${razorpayPaymentId}`;

  const generatedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature, "hex");
  const receivedBuffer = Buffer.from(razorpaySignature, "hex");

  const isValid =
    generatedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(generatedBuffer, receivedBuffer);

  if (!isValid) {
    const error = new Error("INVALID_PAYMENT_SIGNATURE");
    error.statusCode = 400;
    throw error;
  }

  return await handlePaymentCaptured(orderId, razorpayPaymentId);
};

//* Refund Validation
const canRefundPayment = (paymentStatus) => {
  return paymentStatus === "captured";
};

const createRazorpayRefund = async (paymentId, amount, idempotencyKey) => {
  const credentials = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        "X-Refund-Idempotency": idempotencyKey,
      },
      body: JSON.stringify({ amount }),
      signal: AbortSignal.timeout(10000),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.description || "Razorpay refund failed");

    err.statusCode = response.status >= 500 ? 502 : response.status;
    err.razorpayStatus = response.status;

    throw err;
  }

  return data;
};

//* Order confirmation email sender
const handlePaymentCaptured = async (orderId, razorpayPaymentId) => {
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      "payment.status": { $ne: "captured" },
    },
    {
      $set: {
        "payment.status": "captured",
        "payment.razorpayPaymentId": razorpayPaymentId,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (updatedOrder && updatedOrder.inventory.status === "reserved") {
    updatedOrder.inventory.status = "allocated";

    await updatedOrder.save();
  }

  if (!updatedOrder) {
    const existingOrder = await Order.findById(orderId);

    if (
      existingOrder &&
      existingOrder.payment.status === "captured" &&
      existingOrder.payment.razorpayPaymentId === razorpayPaymentId
    ) {
      await existingOrder.populate("user", "name email");

      if (!existingOrder.email.orderConfirmationQueued) {
        const email = await orderConfirmationEmail(existingOrder);

        await queueEmail(email.to, email.subject, email.html);

        existingOrder.email.orderConfirmationQueued = true;

        await existingOrder.save();
      }

      return existingOrder;
    }

    const err = new Error("PAYMENT_ID_MISMATCH");
    err.statusCode = 400;
    throw err;
  }

  await updatedOrder.populate("user", "name email");

  if (!updatedOrder.email.orderConfirmationQueued) {
    const email = await orderConfirmationEmail(updatedOrder);

    await queueEmail(email.to, email.subject, email.html);

    updatedOrder.email.orderConfirmationQueued = true;

    await updatedOrder.save();
  }

  return updatedOrder;
};

//* Payment Failed email sender
const handlePaymentFailed = async (order) => {
  const session = await mongoose.startSession();

  try {
    let shouldSendEmail = false;

    const updatedOrder = await session.withTransaction(async () => {
      const currentOrder = await Order.findById(order._id).session(session);

      if (!currentOrder) {
        const err = new Error("ORDER_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      if (
        currentOrder.payment.status === "captured" ||
        currentOrder.payment.status === "refunded"
      ) {
        return currentOrder;
      }

      if (currentOrder.payment.status === "failed") {
        return currentOrder;
      }

      if (currentOrder.inventory.status === "reserved") {
        for (let i = 0; i < currentOrder.products.length; i++) {
          await Product.findOneAndUpdate(
            {
              _id: currentOrder.products[i].product,
              "variants._id": currentOrder.products[i].variantId,
            },
            {
              $inc: {
                "variants.$.stock": currentOrder.products[i].quantity,
              },
            },
            { session },
          );
        }

        currentOrder.inventory.status = "released";
      }

      currentOrder.payment.status = "failed";

      shouldSendEmail = true;

      await currentOrder.save({ session });

      return currentOrder;
    });

    if (shouldSendEmail) {
      await updatedOrder.populate("user", "name email");

      const email = await paymentFailureEmail(updatedOrder);
      await queueEmail(email.to, email.subject, email.html);
    }

    return updatedOrder;
  } finally {
    await session.endSession();
  }
};

const handleRefundWebhook = async (refund) => {
  const order = await Order.findOne({
    "payment.razorpayPaymentId": refund.payment_id,
  });

  if (!order) {
    const err = new Error("ORDER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (
    order.payment.refund?.razorpayRefundId &&
    order.payment.refund.razorpayRefundId !== refund.id
  ) {
    const err = new Error("REFUND_ID_MISMATCH");
    err.statusCode = 400;
    throw err;
  }

  if (!order.payment.refund) {
    order.payment.refund = {
      amount: refund.amount,
      razorpayRefundId: refund.id,
    };
  } else {
    order.payment.refund.amount = refund.amount;
    order.payment.refund.razorpayRefundId = refund.id;
  }

  if (refund.status === "processed") {
    order.payment.refund.status = "processed";
    order.payment.status = "refunded";
  } else if (refund.status === "failed") {
    order.payment.refund.status = "failed";
  } else {
    order.payment.refund.status = "processing";
  }

  await order.save();

  return order;
};

//* POST(/:id/payment/refund)
const refundPayment = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    const err = new Error("ORDER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (order.status !== "cancelled") {
    const err = new Error("ORDER_NOT_CANCELLED");
    err.statusCode = 400;
    throw err;
  }

  if (order.payment.status === "refunded") {
    return order;
  }

  if (!canRefundPayment(order.payment.status)) {
    const err = new Error("PAYMENT_NOT_REFUNDABLE");
    err.statusCode = 400;
    throw err;
  }

  if (!order.payment.razorpayPaymentId) {
    const err = new Error("RAZORPAY_PAYMENT_NOT_FOUND");
    err.statusCode = 400;
    throw err;
  }

  const refundAmount = Math.round(order.totalPrice * 100);

  const idempotencyKey = `refund-${order._id.toString()}`;

  order.payment.refund = {
    status: "processing",
    amount: refundAmount,
  };

  await order.save();

  try {
    const refund = await createRazorpayRefund(
      order.payment.razorpayPaymentId,
      refundAmount,
      idempotencyKey,
    );

    order.payment.refund.razorpayRefundId = refund.id;

    if (refund.status === "processed") {
      order.payment.status = "refunded";
      order.payment.refund.status = "processed";
    } else if (refund.status === "failed") {
      order.payment.refund.status = "failed";
    } else {
      order.payment.refund.status = "processing";
    }

    await order.save();

    return order;
  } catch (err) {
    if (err.razorpayStatus === 409) {
      const conflictError = new Error("REFUND_ALREADY_PROCESSING");
      conflictError.statusCode = 409;

      throw conflictError;
    }

    throw err;
  }
};

export {
  createRazorpayOrder,
  verifyRazorpayPayment,
  refundPayment,
  handlePaymentCaptured,
  handlePaymentFailed,
  handleRefundWebhook,
};
