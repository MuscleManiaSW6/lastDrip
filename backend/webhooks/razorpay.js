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

  const eventId = req.headers["x-razorpay-event-id"];

  if (!eventId) {
    return res.status(400).json({
      message: "WEBHOOK_EVENT_ID_MISSING",
    });
  }

  let event;

  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    const error = new Error("INVALID_JSON_PAYLOAD");
    error.statusCode = 400;
    throw error;
  }

  await processRazorpayWebhook(event, eventId);

  return res.status(200).json({
    received: true,
  });
};

export { razorpayWebhooks };
