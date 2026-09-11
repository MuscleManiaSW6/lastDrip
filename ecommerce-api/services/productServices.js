import Product from "../models/Product.js";
import mongoose from "mongoose";

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const sortOptions = {
  newest: { _id: -1 },
  oldest: { _id: 1 },
  priceAsc: { price: 1 },
  priceDesc: { price: -1 },
  nameAsc: { name: 1 },
  nameDesc: { name: -1 },
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

  const newProduct = {
    name,
    price,
    description,
    category,
    variants,
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
    update.variants = variants;
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

export {
  getAllProducts,
  getById,
  searchProduct,
  createProduct,
  replaceProduct,
  updateProduct,
  removeProduct,
};
