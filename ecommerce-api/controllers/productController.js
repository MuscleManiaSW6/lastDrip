import Product from "../models/Product.js";
import {
  createProduct,
  getAllProducts,
  getById,
  removeProduct,
  replaceProduct,
  searchProduct,
  updateProduct,
} from "../services/productServices.js";

//* GET(/)
const getProduct = async (req, res) => {
  const { name, price, id, page = 1, limit = 5, sort } = req.query;

  if (name || price || id) {
    return getSearch(req, res);
  }

  const product = await getAllProducts(page, limit, sort);
  return res.status(200).json(product);
};

//* GET(/:id)
const getProductId = async (req, res) => {
  const { id } = req.params;
  const product = await getById(id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.status(200).json(product);
};

//* GET(/search)
const getSearch = async (req, res) => {
  const { name, price, id } = req.query;

  const product = await searchProduct(name, price, id);

  if (product === null) {
    return res.status(400).json({ message: "Invalid Product ID" });
  }

  if (product.length > 0) {
    return res.status(200).json(product);
  }

  return res.status(404).json({ message: "Product not found" });
};

//* POST(/)
const postProduct = async (req, res) => {
  const { name, price, description, category, stock } = req.body;
  const product = await createProduct(
    name,
    price,
    description,
    category,
    stock,
  );

  res.status(201).json(product);
};

//* PUT(/:id)
const putProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, description, category, stock } = req.body;
  const product = await replaceProduct(
    name,
    price,
    description,
    category,
    stock,
    id,
  );

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.status(200).json(product);
};

//* PATCH(/:id)
const patchProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, description, category, stock } = req.body;
  const product = await updateProduct(
    name,
    price,
    description,
    category,
    stock,
    id,
  );

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.status(200).json(product);
};

//* DELETE(/:id)
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const deleted = await removeProduct(id);

  if (!deleted) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.status(200).json({ message: "Product removed successfully" });
};

export {
  getProduct,
  getProductId,
  getSearch,
  postProduct,
  putProduct,
  patchProduct,
  deleteProduct,
};
