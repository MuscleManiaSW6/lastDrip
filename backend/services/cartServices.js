import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

//* GET (/cart)
const getCart = async (userId) => {
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    return null;
  }

  await userCart.populate("items.product", "name price category variants");

  return userCart;
};

//* POST (/cart/items)
const addToCart = async (userId, products) => {
  let userCart = await Cart.findOne({ user: userId });

  for (let i = 0; i < products.length; i++) {
    const product = await Product.findById(products[i].product);

    if (!product) {
      const err = new Error("PRODUCT_NOT_FOUND");
      err.statusCode = 404;
      throw err;
    }

    if (!product.isActive) {
      const err = new Error("PRODUCT_NOT_AVAILABLE");
      err.statusCode = 400;
      throw err;
    }

    const variant = product.variants.id(products[i].variantId);

    if (!variant) {
      const err = new Error("VARIANT_NOT_FOUND");
      err.statusCode = 404;
      throw err;
    }

    if (variant.stock < products[i].quantity) {
      const err = new Error("INSUFFICIENT_STOCK");
      err.statusCode = 400;
      throw err;
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
      (item) =>
        item.product.toString() === products[i].product.toString() &&
        item.variantId.toString() === products[i].variantId.toString(),
    );

    if (existingItem) {
      const product = await Product.findById(products[i].product);
      const variant = product.variants.id(products[i].variantId);

      if (variant.stock < existingItem.quantity + products[i].quantity) {
        const err = new Error("INSUFFICIENT_STOCK");
        err.statusCode = 400;
        throw err;
      }

      existingItem.quantity += products[i].quantity;
    } else {
      userCart.items.push(products[i]);
    }
  }

  await userCart.save();

  return userCart;
};

//* PATCH (/cart/items/:productId)
const updateCart = async (userId, productId, variantId, quantity) => {
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    const err = new Error("EMPTY_CART");
    err.statusCode = 400;
    throw err;
  }

  const existingItem = userCart.items.find(
    (item) =>
      item.product.toString() === productId.toString() &&
      item.variantId.toString() === variantId.toString(),
  );

  if (!existingItem) {
    const err = new Error("ITEM_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    const err = new Error("PRODUCT_NOT_AVAILABLE");
    err.statusCode = 400;
    throw err;
  }

  const variant = product.variants.id(variantId);

  if (!variant) {
    const err = new Error("VARIANT_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (variant.stock < quantity) {
    const err = new Error("INSUFFICIENT_STOCK");
    err.statusCode = 400;
    throw err;
  }

  existingItem.quantity = quantity;

  await userCart.save();

  return userCart;
};

//* DELETE (/cart/items/:productId)
const removeFromCart = async (userId, productId, variantId) => {
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    const err = new Error("EMPTY_CART");
    err.statusCode = 400;
    throw err;
  }

  const existingItem = userCart.items.find(
    (item) =>
      item.product.toString() === productId.toString() &&
      item.variantId.toString() === variantId.toString(),
  );

  if (!existingItem) {
    const err = new Error("ITEM_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  userCart.items = userCart.items.filter(
    (item) =>
      !(
        item.product.toString() === productId.toString() &&
        item.variantId.toString() === variantId.toString()
      ),
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
