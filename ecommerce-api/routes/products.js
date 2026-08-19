import express from "express";
import {
  deleteProduct,
  getProduct,
  getProductId,
  getSearch,
  patchProduct,
  postProduct,
  putProduct,
} from "../controllers/productController.js";
import { validatePatch, validatePut } from "../middlewares/validateProducts.js";
import validateObjectId from "../middlewares/validateProductId.js";
import authenticateUser from "../middlewares/authenticateToken.js";
import authorizeAdmin from "../middlewares/authorizeAdmin.js";

const router = express.Router();

router.get("/", getProduct);

router.get("/search", getSearch);

router.get("/:id", validateObjectId, getProductId);

router.post("/", authenticateUser, authorizeAdmin, postProduct);

router.put(
  "/:id",
  validateObjectId,
  authenticateUser,
  authorizeAdmin,
  validatePut,
  putProduct,
);

router.patch(
  "/:id",
  validateObjectId,
  authenticateUser,
  authorizeAdmin,
  validatePatch,
  patchProduct,
);

router.delete(
  "/:id",
  validateObjectId,
  authenticateUser,
  authorizeAdmin,
  deleteProduct,
);

export default router;
