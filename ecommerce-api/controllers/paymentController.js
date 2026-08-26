import { verifyRazorpayPayment } from "../services/paymentServices.js";

const verifyPayment = async (req, res) => {
  const { id } = req.params;

  const { userId } = req.user;

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;

  console.log("PARAM ORDER ID:", id);
  console.log("AUTH USER:", userId);
  console.log("BODY:", req.body);

  const order = await verifyRazorpayPayment(
    id,
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  return res.status(200).json(order);
};

export { verifyPayment };
