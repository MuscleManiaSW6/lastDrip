import express from "express";

import authenticateUser from "../middlewares/authenticateToken.js";
import authorizeAdmin from "../middlewares/authorizeAdmin.js";
import validateObjectId from "../middlewares/validateProductId.js";
import { validateStatus } from "../middlewares/statusValidation.js";
import validateRequest from "../middlewares/validateRequest.js";
import { orderSchema } from "../middlewares/requestSchemas.js";
import { paymentLimiter } from "../middlewares/rateLimiters.js";

import {
  cancelUserOrder,
  getAllOrders,
  getOrders,
  getOrdersById,
  orderProduct,
  updateOrderStatus,
} from "../controllers/orderController.js";

import {
  verifyPayment,
  refundOrderPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/", authenticateUser, validateRequest(orderSchema), orderProduct);

router.get("/", authenticateUser, getOrders);

router.get("/admin", authenticateUser, authorizeAdmin, getAllOrders);

router.get("/:id", validateObjectId, authenticateUser, getOrdersById);

router.patch(
  "/:id/status",
  validateObjectId,
  authenticateUser,
  authorizeAdmin,
  validateStatus,
  updateOrderStatus,
);

router.patch(
  "/:id/cancel",
  validateObjectId,
  authenticateUser,
  cancelUserOrder,
);

//* PAYMENT ROUTES
router.post(
  "/:id/payment/verify",
  paymentLimiter,
  validateObjectId,
  authenticateUser,
  verifyPayment,
);

router.post(
  "/:id/payment/refund",
  validateObjectId,
  authenticateUser,
  refundOrderPayment,
);

export default router;
