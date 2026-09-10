import {
  verifyRazorpayWebhook,
  processRazorpayWebhook,
} from "../services/webhookServices.js";

const razorpayWebhooks = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    return res.status(400).json({
      message: "MISSING_WEBHOOK_SIGNATURE",
    });
  }

  const isValid = verifyRazorpayWebhook(req.body, signature);

  if (!isValid) {
    return res.status(400).json({
      message: "INVALID_WEBHOOK_SIGNATURE",
    });
  }

  const event = JSON.parse(req.body.toString());

  await processRazorpayWebhook(event);

  return res.status(200).json({
    received: true,
  });
};

export { razorpayWebhooks };
