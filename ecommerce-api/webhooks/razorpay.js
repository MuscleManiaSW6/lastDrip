const razorpayWebhooks = async (req, res) => {
  console.log("Razorpay webhook received");

  const signature = req.headers["x-razorpay-signature"];

  console.log("Signature", signature);
  console.log("Body type:", Buffer.isBuffer(req.body));
  console.log("Raw body:", req.body.toString());

  return res.status(200).json({
    received: true,
  });
};

export { razorpayWebhooks };