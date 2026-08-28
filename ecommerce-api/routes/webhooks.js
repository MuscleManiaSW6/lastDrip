import express from "express";
import { razorpayWebhooks } from "../webhooks/razorpay.js";

const router = express.Router();

router.post("/razorpay", razorpayWebhooks);

export default router;
