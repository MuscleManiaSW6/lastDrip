import express from "express";

import authenticateToken from "../middlewares/authenticateToken.js";

import {
  userRegister,
  userLogin,
  currentUser,
  updateUserProfile,
  userAddress,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", userRegister);

router.post("/login", userLogin);

router.get("/me", authenticateToken, currentUser);

router.patch("/me", authenticateToken, updateUserProfile);

router.get("/addresses", authenticateToken, userAddress);

router.post("/addresses", authenticateToken, addUserAddress);

router.patch("/addresses/:id", authenticateToken, updateUserAddress);

router.delete("/addresses/:id", authenticateToken, deleteUserAddress);

export default router;
