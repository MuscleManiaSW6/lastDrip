import crypto from "crypto";

import Order from "../models/Orders.js";
import razorpay from "../config/razorpay.js";
import {
  orderConfirmationEmail,
  paymentFailureEmail,
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
      if (!existingOrder.email.orderConfirmationSent) {
        await existingOrder.populate("user", "name email");

        await orderConfirmationEmail(existingOrder);

        existingOrder.email.orderConfirmationSent = true;

        await existingOrder.save();
      }

      return existingOrder;
    }

    const err = new Error("PAYMENT_ID_MISMATCH");
    err.statusCode = 400;
    throw err;
  }

  if (!updatedOrder.email.orderConfirmationSent) {
    await updatedOrder.populate("user", "name email");

    await orderConfirmationEmail(updatedOrder);

    updatedOrder.email.orderConfirmationSent = true;

    await updatedOrder.save();
  }

  return updatedOrder;
};

//* Payment Failed email sender
const handlePaymentFailed = async (order) => {
  if (order.payment.status === "failed") {
    return order;
  }

  order.payment.status = "failed";

  await order.save();

  await order.populate("user", "name email");

  await paymentFailureEmail(order);

  return order;
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
