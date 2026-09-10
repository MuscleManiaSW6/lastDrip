import express from "express";

import authenticateUser from "../middlewares/authenticateToken.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  cartAddSchema,
  cartItemSchema,
  removeCartItemSchema,
} from "../middlewares/requestSchemas.js";

import {
  addCartItem,
  clearUserCart,
  getUserCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/", authenticateUser, getUserCart);

router.post(
  "/items",
  authenticateUser,
  validateRequest(cartAddSchema),
  addCartItem,
);

router.patch(
  "/items/:productId",
  authenticateUser,
  validateRequest(cartItemSchema),
  updateCartItem,
);

router.delete(
  "/items/:productId",
  authenticateUser,
  validateRequest(removeCartItemSchema),
  removeCartItem,
);

router.delete("/", authenticateUser, clearUserCart);

export default router;
