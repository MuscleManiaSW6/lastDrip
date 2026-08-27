import crypto from "crypto";

import Order from "../models/Orders.js";
import razorpay from "../config/razorpay.js";

const createRazorpayOrder = async (amount, receipt) => {
  return await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: receipt,
  });
};

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

  if (order.payment.status === "captured") {
    if (order.payment.razorpayPaymentId === razorpayPaymentId) {
      return order;
    }
    const error = new Error("PAYMENT_ID_MISMATCH");
    error.statusCode = 400;
    throw error;
  }

  order.payment.status = "captured";
  order.payment.razorpayPaymentId = razorpayPaymentId;

  await order.save();

  return order;
};

export { createRazorpayOrder, verifyRazorpayPayment };
