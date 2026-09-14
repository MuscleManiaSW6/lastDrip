import mongoose from "mongoose";

const validateProductVariantIds = (req, res, next) => {
  const { productId, variantId } = req.params;

  if (
    !mongoose.isValidObjectId(productId) ||
    !mongoose.isValidObjectId(variantId)
  ) {
    return res.status(400).json({
      message: "invalid ID",
    });
  }

  next();
};

export default validateProductVariantIds;