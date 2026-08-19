import express from "express";
import authenticateUser from "../middlewares/authenticateToken.js";
import {
  getAllOrders,
  getOrders,
  getOrdersById,
  orderProduct,
  updateOrderStatus,
} from "../controllers/orderController.js";
import validateObjectId from "../middlewares/validateProductId.js";
import authorizeAdmin from "../middlewares/authorizeAdmin.js";
import { validateStatus } from "../middlewares/statusValidation.js";

const router = express.Router();

router.post("/", authenticateUser, orderProduct);

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

export default router;
