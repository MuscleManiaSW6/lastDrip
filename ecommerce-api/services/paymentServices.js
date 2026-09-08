import crypto from "crypto";
import mongoose from "mongoose";

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
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
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
        "inventory.status": "allocated",
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!updatedOrder) {
    const existingOrder = await Order.findById(orderId);

    if (
      existingOrder &&
      existingOrder.payment.status === "captured" &&
      existingOrder.payment.razorpayPaymentId === razorpayPaymentId
    ) {
      await existingOrder.populate("user", "name, email");

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
          await Product.findByIdAndUpdate(
            currentOrder.products[i].product,
            {
              $inc: {
                stock: currentOrder.products[i].quantity,
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

//* POST(/:id/payment/refund)
const refundPayment = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    const error = new Error("ORDER_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  if (order.status !== "cancelled") {
    const error = new Error("ORDER_NOT_CANCELLED");
    error.statusCode = 400;
    throw error;
  }

  if (order.payment.status === "refunded") {
    return order;
  }

  if (!canRefundPayment(order.payment.status)) {
    const error = new Error("PAYMENT_NOT_REFUNDABLE");
    error.statusCode = 400;
    throw error;
  }

  order.payment.status = "refunded";

  await order.save();
  return order;
};

export {
  createRazorpayOrder,
  verifyRazorpayPayment,
  refundPayment,
  handlePaymentCaptured,
  handlePaymentFailed,
};
