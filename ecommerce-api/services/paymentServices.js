import razorpay from "../config/razorpay.js";

const createRazorpayOrder = async (amount, receipt) => {
  return await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: receipt,
  });
};

const verifyRazorpayPayment = async () => {};

export { createRazorpayOrder };
