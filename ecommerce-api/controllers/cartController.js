import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCart,
} from "../services/cartServices.js";

//* GET (/cart)
const getUserCart = async (req, res) => {
  const { userId } = req.user;

  const cart = await getCart(userId);

  if (!cart) {
    return res.status(200).json({ items: [] });
  }

  return res.status(200).json(cart);
};

//* POST (/cart/items)
const addCartItem = async (req, res) => {
  const { userId } = req.user;
  const { products } = req.body;

  const cart = await addToCart(userId, products);

  return res.status(201).json(cart);
};

//* PATCH (/cart/items/:productId)
const updateCartItem = async (req, res) => {
  const { userId } = req.user;
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await updateCart(userId, productId, quantity);

  return res.status(200).json(cart);
};

//* DELETE (/cart/items/:productId)
const removeCartItem = async (req, res) => {
  const { userId } = req.user;
  const { productId } = req.params;

  const cart = await removeFromCart(userId, productId);

  return res.status(200).json(cart);
};

//* DELETE (/cart)
const clearUserCart = async (req, res) => {
  const { userId } = req.user;

  const cart = await clearCart(userId);

  return res.status(200).json(cart);
};

export {
  getUserCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearUserCart,
};
