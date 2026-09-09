import Order from "../models/Orders.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";

import mongoose from "mongoose";

import { createRazorpayOrder } from "./paymentServices.js";

const releaseInventory = async (order, session) => {
  if (order.inventory.status === "released") {
    return;
  }

  for (let i = 0; i < order.products.length; i++) {
    await Product.findOneAndUpdate(
      {
        _id: order.products[i].product,
        "variants._id": order.products[i].variantId,
      },
      {
        $inc: {
          "variants.$.stock": order.products[i].quantity,
        },
      },
      { session },
    );
  }

  order.inventory.status = "released";

  await order.save({ session });
};

const releaseOrderInventory = async (orderId) => {
  const session = await mongoose.startSession();

  try {
    let releasedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        const err = new Error("ORDER_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      // Inventory has already been released.
      await releaseInventory(order, session);

      releasedOrder = order;
    });

    return releasedOrder;
  } finally {
    await session.endSession();
  }
};

//* POST(/)
const userOrder = async (userId, idempotencyKey, addressId) => {
  const existingOrder = await Order.findOne({
    user: userId,
    idempotencyKey,
  });

  if (existingOrder) {
    await existingOrder.populate("user", "name email");
    return existingOrder;
  }

  const session = await mongoose.startSession();

  try {
    const order = await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);

      if (!user) {
        const err = new Error("USER_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      const address = user.addresses.id(addressId);

      if (!address) {
        const err = new Error("ADDRESS_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      const cart = await Cart.findOne({ user: userId }).session(session);

      if (!cart || cart.items.length === 0) {
        const err = new Error("EMPTY_CART");
        err.statusCode = 400;
        throw err;
      }

      let totalPrice = 0;
      const orderArray = [];

      for (let i = 0; i < cart.items.length; i++) {
        const product = await Product.findById(cart.items[i].product).session(
          session,
        );

        if (!product) {
          const err = new Error("PRODUCT_NOT_FOUND");
          err.statusCode = 404;
          throw err;
        }

        const variant = product.variants.id(cart.items[i].variantId);

        if (!variant) {
          const err = new Error("VARIANT_NOT_FOUND");
          err.statusCode = 404;
          throw err;
        }

        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            "variants._id": cart.items[i].variantId,
            "variants.stock": {
              $gte: cart.items[i].quantity,
            },
          },
          {
            $inc: {
              "variants.$.stock": -cart.items[i].quantity,
            },
          },
          {
            session,
            returnDocument: "after",
          },
        );

        if (!updatedProduct) {
          const err = new Error("INSUFFICIENT_STOCK");
          err.statusCode = 400;
          throw err;
        }

        orderArray.push({
          product: product._id,
          variantId: variant._id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          name: product.name,
          price: variant.price ?? product.price,
          quantity: cart.items[i].quantity,
        });

        totalPrice += (variant.price ?? product.price) * cart.items[i].quantity;
      }

      const [newOrder] = await Order.create(
        [
          {
            user: userId,
            idempotencyKey,
            products: orderArray,

            shippingAddress: {
              fullName: address.fullName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
            },

            totalPrice: totalPrice,

            inventory: {
              status: "reserved",
            },
          },
        ],
        { session },
      );

      cart.items = [];

      await cart.save({ session });

      return newOrder;
    });

    let razorpayOrder;

    try {
      razorpayOrder = await createRazorpayOrder(
        order.totalPrice,
        order._id.toString(),
      );
    } catch (err) {
      await releaseOrderInventory(order._id);

      order.status = "cancelled";
      await order.save();

      throw err;
    }

    order.payment.razorpayOrderId = razorpayOrder.id;

    await order.save();

    await order.populate("user", "name email");

    return order;
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const existingOrder = await Order.findOne({
        user: userId,
        idempotencyKey,
      });

      if (existingOrder) {
        await existingOrder.populate("user", "name email");
        return existingOrder;
      }
    }

    throw err;
  } finally {
    await session.endSession();
  }
};

//* GET(/)
const getUserOrder = async (userId) => {
  return await Order.find({ user: userId })
    .select("-user")
    .sort({ createdAt: -1 });
};

//* GET(/:id)
const getUserOrderById = async (orderId, userId) => {
  return await Order.findOne({
    _id: orderId,
    user: userId,
  }).select("-user");
};

//* GET(/admin)
const getAllUserOrder = async () => {
  return await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 });
};

//* PATCH(/:id/status)
const updateStatus = async (id, status, carrier, trackingNumber) => {
  const order = await Order.findById(id);

  if (!order) {
    const error = new Error("ORDER_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  const allowed = canChangeOrderStatus(order.status, status);

  if (!allowed) {
    const error = new Error("INVALID_STATUS_TRANSITION");
    error.statusCode = 400;
    throw error;
  }

  if (status === "processing" && order.payment.status !== "captured") {
    const error = new Error("PAYMENT_NOT_CAPTURED");
    error.statusCode = 400;
    throw error;
  }

  order.status = status;

  if (carrier !== undefined) {
    order.shipping.carrier = carrier;
  }

  if (trackingNumber !== undefined) {
    order.shipping.trackingNumber = trackingNumber;
  }

  if (status === "shipped" && !order.shipping.shippedAt) {
    order.shipping.shippedAt = new Date();
  }

  if (status === "delivered" && !order.shipping.deliveredAt) {
    order.shipping.deliveredAt = new Date();
  }

  await order.save();

  await order.populate([
    { path: "user", select: "name email" },
    { path: "products.product", select: "name price" },
  ]);

  return order;
};

//*validates the status change
const canChangeOrderStatus = (currentStatus, newStatus) => {
  const allowedTransitions = {
    pending: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
};

//* PATCH(/:id/cancel)
const cancelOrder = async (orderId, userId) => {
  const session = await mongoose.startSession();

  try {
    let cancelledOrder;

    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: userId }).session(
        session,
      );

      if (!order) {
        const error = new Error("ORDER_NOT_FOUND");
        error.statusCode = 404;
        throw error;
      }

      if (!canChangeOrderStatus(order.status, "cancelled")) {
        const error = new Error("ORDER_CANNOT_BE_CANCELLED");
        error.statusCode = 400;
        throw error;
      }

      await releaseInventory(order, session);

      order.status = "cancelled";
      await order.save({ session });
      cancelledOrder = order;
    });

    await cancelledOrder.populate([
      { path: "user", select: "name email" },
      { path: "products.product", select: "name price" },
    ]);

    return cancelledOrder;
  } finally {
    await session.endSession();
  }
};

export {
  userOrder,
  getUserOrder,
  getUserOrderById,
  getAllUserOrder,
  updateStatus,
  cancelOrder,
  releaseOrderInventory,
};
