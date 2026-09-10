import express from "express";

import authenticateUser from "../middlewares/authenticateToken.js";
import authorizeAdmin from "../middlewares/authorizeAdmin.js";

import {
  userRegister,
  userLogin,
  currentUser,
  updateUserProfile,
  userAddress,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  adminCustomers,
  adminCustomerById,
  updateCustomerStatus,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/register", userRegister);
router.post("/login", userLogin);

router.get("/me", authenticateUser, currentUser);
router.patch("/me", authenticateUser, updateUserProfile);

router.get("/addresses", authenticateUser, userAddress);
router.post("/addresses", authenticateUser, addUserAddress);
router.patch("/addresses/:id", authenticateUser, updateUserAddress);
router.delete("/addresses/:id", authenticateUser, deleteUserAddress);

router.get("/admin", authenticateUser, authorizeAdmin, adminCustomers);
router.get("/admin/:id", authenticateUser, authorizeAdmin, adminCustomerById);
router.patch(
  "/admin/:id/status",
  authenticateUser,
  authorizeAdmin,
  updateCustomerStatus,
);

export default router;
