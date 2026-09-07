import Order from "../models/Orders.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import mongoose from "mongoose";
import { createRazorpayOrder } from "./paymentServices.js";

//* POST(/)
const userOrder = async (userId) => {
  const session = await mongoose.startSession();

  try {
    const order = await session.withTransaction(async () => {
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

        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            stock: { $gte: cart.items[i].quantity },
          },
          { $inc: { stock: -cart.items[i].quantity } },
          { session },
        );

        if (!updatedProduct) {
          const err = new Error("INSUFFICIENT_STOCK");
          err.statusCode = 400;
          throw err;
        }

        orderArray.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: cart.items[i].quantity,
        });

        totalPrice += product.price * cart.items[i].quantity;
      }

      const [newOrder] = await Order.create(
        [
          {
            user: userId,
            products: orderArray,
            totalPrice: totalPrice,
          },
        ],
        { session },
      );

      cart.items = [];

      await cart.save({ session });

      return newOrder;
    });

    const razorpayOrder = await createRazorpayOrder(
      order.totalPrice,
      order._id.toString(),
    );

    order.payment.razorpayOrderId = razorpayOrder.id;

    await order.save();

    await order.populate("user", "name email");

    return order;
  } finally {
    await session.endSession();
  }
};

//* GET(/)
const getUserOrder = async (userId) => {
  return await Order.find({ user: userId })
    .populate("user", "name email")
    .populate("products.product", "name price");
};

//* GET(/:id)
const getUserOrderById = async (orderId, userId) => {
  return await Order.findOne({ _id: orderId, user: userId })
    .populate("user", "name email")
    .populate("products.product", "name price");
};

//* GET(/admin)
const getAllUserOrder = async () => {
  return await Order.find()
    .populate("user", "name email")
    .populate("products.product", "name price");
};

//* PATCH(/:id/status)
const updateStatus = async (id, status) => {
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

      for (const item of order.products) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: { stock: item.quantity },
          },
          { session },
        );
      }

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
};
