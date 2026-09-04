import express from "express";

import authenticateUser from "../middlewares/authenticateToken.js";
import {
  addCartItem,
  clearUserCart,
  getUserCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/", authenticateUser, getUserCart);

router.post("/items", authenticateUser, addCartItem);

router.patch("/items/:productId", authenticateUser, updateCartItem);

router.delete("/items/:productId", authenticateUser, removeCartItem);

router.delete("/", authenticateUser, clearUserCart);

export default router;
