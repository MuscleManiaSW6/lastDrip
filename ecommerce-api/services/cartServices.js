import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

//* GET (/cart)
const getCart = async (userId) => {
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    return null;
  }

  await userCart.populate("items.product", "name price category");

  return userCart;
};

//* POST (/cart/items)
const addToCart = async (userId, products) => {
  let userCart = await Cart.findOne({ user: userId });

  for (let i = 0; i < products.length; i++) {
    const product = await Product.findById(products[i].product);

    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
  }
  if (!userCart) {
    userCart = await Cart.create({
      user: userId,
      items: products,
    });

    return userCart;
  }

  for (let i = 0; i < products.length; i++) {
    const existingItem = userCart.items.find(
      (item) => item.product.toString() === products[i].product.toString(),
    );

    if (existingItem) {
      existingItem.quantity += products[i].quantity;
    } else {
      userCart.items.push(products[i]);
    }
  }

  await userCart.save();

  return userCart;
};

//* PATCH (/cart/items/:productId)
const updateCart = async (userId, productId, quantity) => {
  let userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    const err = new Error("EMPTY_CART");
    err.statusCode = 400;
    throw err;
  }

  const existingItem = userCart.items.find(
    (item) => item.product.toString() === productId.toString(),
  );

  if (!existingItem) {
    const err = new Error("ITEM_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  existingItem.quantity = quantity;

  await userCart.save();

  return userCart;
};

//* DELETE (/cart/items/:productId)
const removeFromCart = async (userId, productId) => {
  let userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    const err = new Error("EMPTY_CART");
    err.statusCode = 400;
    throw err;
  }

  const existingItem = userCart.items.find(
    (item) => item.product.toString() === productId.toString(),
  );

  if (!existingItem) {
    const err = new Error("ITEM_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  userCart.items = userCart.items.filter(
    (item) => item.product.toString() !== productId.toString(),
  );

  await userCart.save();

  return userCart;
};

//* DELETE (/cart)
const clearCart = async (userId) => {
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    const err = new Error("EMPTY_CART");
    err.statusCode = 400;
    throw err;
  }

  userCart.items = [];

  await userCart.save();

  return userCart;
};

export { getCart, addToCart, updateCart, removeFromCart, clearCart };
