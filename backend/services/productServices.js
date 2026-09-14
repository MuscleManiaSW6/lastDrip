import Product from "../models/Product.js";
import mongoose from "mongoose";

//* Escape Regex Helper
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

//* Sort Options Helper
const sortOptions = {
  newest: { _id: -1 },
  oldest: { _id: 1 },
  priceAsc: { price: 1 },
  priceDesc: { price: -1 },
  nameAsc: { name: 1 },
  nameDesc: { name: -1 },
};

//* Variant Helper
const prepareVariantsForUpdate = (incomingVariants, existingVariants) => {
  return incomingVariants.map((variant) => {
    if (variant._id) {
      const existingVariant = existingVariants.id(variant._id);

      if (!existingVariant) {
        const err = new Error("VARIANT_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      return {
        _id: existingVariant._id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        price: variant.price,
        stock: existingVariant.stock,
      };
    }

    return {
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price: variant.price,
      stock: 0,
    };
  });
};

//* GET(/)
const getAllProducts = async (page, limit, sort, name, price, id) => {
  const skip = (page - 1) * limit;

  const filter = {
    isActive: true,
  };

  if (name) {
    filter.name = {
      $regex: escapeRegex(name),
      $options: "i",
    };
  }

  if (price) {
    filter.price = Number(price);
  }

  if (id) {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    filter._id = id;
  }

  const total = await Product.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  const sortQuery = sortOptions[sort] || sortOptions.newest;

  const products = await Product.find(filter)
    .sort(sortQuery)
    .skip(skip)
    .limit(limit);

  return {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
    products,
  };
};

//* GET(/:id)
const getById = (id) => {
  return Product.findOne({
    _id: id,
    isActive: true,
  });
};

//* GET(/search)
const searchProduct = (name, price, id) => {
  const filter = {
    isActive: true,
  };

  if (name) {
    filter.name = {
      $regex: escapeRegex(name),
      $options: "i",
    };
  }

  if (price) {
    filter.price = Number(price);
  }

  if (id) {
    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    filter._id = id;
  }

  return Product.find(filter);
};

//* POST(/)
const createProduct = (
  name,
  price,
  description,
  category,
  variants,
  images,
) => {
  const newProduct = {
    name,
    price: Number(price),
    description,
    category,
    variants,
    images,
  };

  return Product.create(newProduct);
};

//* PUT(/:id)
const replaceProduct = async (
  name,
  price,
  description,
  category,
  variants,
  images,
  id,
) => {
  const existingProduct = await Product.findById(id);

  if (!existingProduct) {
    return null;
  }

  const updatedVariants = prepareVariantsForUpdate(
    variants,
    existingProduct.variants,
  );

  const newProduct = {
    name,
    price,
    description,
    category,
    variants: updatedVariants,
    images,
  };

  return Product.findByIdAndUpdate(id, newProduct, {
    returnDocument: "after",
    runValidators: true,
  });
};

//* PATCH(/:id)
const updateProduct = async (
  name,
  price,
  description,
  category,
  variants,
  images,
  isActive,
  id,
) => {
  const update = {};

  if (name !== undefined) {
    update.name = name;
  }

  if (price !== undefined) {
    update.price = price;
  }

  if (description !== undefined) {
    update.description = description;
  }

  if (category !== undefined) {
    update.category = category;
  }

  if (variants !== undefined) {
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return null;
    }

    update.variants = prepareVariantsForUpdate(
      variants,
      existingProduct.variants,
    );
  }

  if (images !== undefined) {
    update.images = images;
  }

  if (isActive !== undefined) {
    update.isActive = isActive;
  }

  return Product.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    runValidators: true,
  });
};

//* DELETE(/:id)
const removeProduct = (id) => {
  return Product.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
    },
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );
};

//* PATCH(/:productId/variants/:variantId/stock)
const updateVariantStock = async (productId, variantId, adjustment) => {
  if (adjustment === 0) {
    const product = await Product.findOne({
      _id: productId,
      "variants._id": variantId,
    });

    if (!product) {
      return null;
    }

    const variant = product.variants.id(variantId);

    return {
      product,
      variant,
    };
  }

  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      "variants._id": variantId,
      variants: {
        $elemMatch: {
          _id: variantId,
          stock: {
            $gte: adjustment < 0 ? Math.abs(adjustment) : 0,
          },
        },
      },
    },
    {
      $inc: {
        "variants.$.stock": adjustment,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!product) {
    return null;
  }

  const variant = product.variants.id(variantId);

  return {
    product,
    variant,
  };
};

export {
  getAllProducts,
  getById,
  searchProduct,
  createProduct,
  replaceProduct,
  updateProduct,
  removeProduct,
  updateVariantStock,
};
