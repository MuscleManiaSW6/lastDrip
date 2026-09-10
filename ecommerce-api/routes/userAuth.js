import express from "express";

import authenticateUser from "../middlewares/authenticateToken.js";
import authorizeAdmin from "../middlewares/authorizeAdmin.js";
import validateRequest from "../middlewares/validateRequest.js";

import { authLimiter } from "../middlewares/rateLimiters.js";

import {
  addressSchema,
  loginSchema,
  registerSchema,
  updateAddressSchema,
  updateCustomerStatusSchema,
  updateProfileSchema,
} from "../middlewares/requestSchemas.js";

import validateObjectId from "../middlewares/validateProductId.js";

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

router.post(
  "/register",
  authLimiter,
  validateRequest(registerSchema),
  userRegister,
);
router.post("/login", authLimiter, validateRequest(loginSchema), userLogin);

router.get("/me", authenticateUser, currentUser);
router.patch(
  "/me",
  authenticateUser,
  validateRequest(updateProfileSchema),
  updateUserProfile,
);

router.get("/addresses", authenticateUser, userAddress);
router.post(
  "/addresses",
  authenticateUser,
  validateRequest(addressSchema),
  addUserAddress,
);
router.patch(
  "/addresses/:id",
  authenticateUser,
  validateRequest(updateAddressSchema),
  updateUserAddress,
);
router.delete(
  "/addresses/:id",
  authenticateUser,
  validateObjectId,
  deleteUserAddress,
);

router.get("/admin", authenticateUser, authorizeAdmin, adminCustomers);
router.get(
  "/admin/:id",
  authenticateUser,
  authorizeAdmin,
  validateObjectId,
  adminCustomerById,
);
router.patch(
  "/admin/:id/status",
  authenticateUser,
  authorizeAdmin,
  validateRequest(updateCustomerStatusSchema),
  updateCustomerStatus,
);

export default router;
