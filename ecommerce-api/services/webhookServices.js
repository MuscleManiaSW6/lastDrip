import crypto from "crypto";
import Order from "../models/Orders.js";

const verifyRazorpayWebhook = (rawBody, signature) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return generatedSignature === signature;
};

const processRazorpayWebhook = async (event) => {
  if (event.event !== "payment.captured") {
    return;
  }

  const payment = event.payload.payment.entity;

  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const order = await Order.findOne({
    "payment.razorpayOrderId": razorpayOrderId,
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (order.payment.status === "captured") {
    if (order.payment.razorpayPaymentId === razorpayPaymentId) {
      return order;
    }

    throw new Error("PAYMENT_ID_MISMATCH");
  }

  order.payment.status = "captured";
  order.payment.razorpayPaymentId = razorpayPaymentId;

  await order.save();

  return order;
};

export { verifyRazorpayWebhook, processRazorpayWebhook };
