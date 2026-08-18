import Product from "../models/Product.js";
import mongoose from "mongoose";

//* GET(/)
const getAllProducts = async (page, limit, sort) => {
  const skip = (page - 1) * limit;
  const total = await Product.countDocuments();
  const totalPages = Math.ceil(total / limit);
  const product = await Product.find().sort(sort).skip(skip).limit(limit);
  const prodInfo = {
    page: Number(page),
    limit: Number(limit),
    total: Number(total),
    totalPages: Number(totalPages),
    products: product,
  };

  return prodInfo;
};

//* GET(/:id)
const getById = (id) => {
  return Product.findById(id);
};

//* GET(/search)
const searchProduct = (name, price, id) => {
  const filter = {};

  if (name) {
    filter.name = {
      $regex: name,
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
const createProduct = (name, price, description, category, stock) => {
  const newProduct = {
    name: name,
    price: Number(price),
    description: description,
    category: category,
    stock: Number(stock),
  };
  return Product.create(newProduct);
};

//* PUT(/:id)
const replaceProduct = (name, price, description, category, stock, id) => {
  const newProduct = {
    name: name,
    price: price,
    description: description,
    category: category,
    stock: stock,
  };

  return Product.findByIdAndUpdate(id, newProduct, {
    returnDocument: "after",
    runValidators: true,
  });
};

//* PATCH(/:id)
const updateProduct = (name, price, description, category, stock, id) => {
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

  if (stock !== undefined) {
    update.stock = stock;
  }

  return Product.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    runValidators: true,
  });
};

//* DELETE(/:id)
const removeProduct = (id) => {
  return Product.findByIdAndDelete(id);
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
