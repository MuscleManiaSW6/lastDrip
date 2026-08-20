import Order from "../models/Orders.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

//* POST(/)
const userOrder = async (userId, products) => {
  const session = await mongoose.startSession();

  try {
    const order = await session.withTransaction(async () => {
      let totalPrice = 0;
      let orderArray = [];

      for (let i = 0; i < products.length; i++) {
        const product = await Product.findById(products[i].product).session(
          session,
        );

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            stock: { $gte: products[i].quantity },
          },
          { $inc: { stock: -products[i].quantity } },
          { session },
        );

        if (!updatedProduct) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        orderArray.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: products[i].quantity,
        });

        totalPrice += product.price * products[i].quantity;
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

      return newOrder;
    });

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
  return await Order.findByIdAndUpdate(
    id,
    { status: status },
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .populate("user", "name email")
    .populate("products.product", "name price");
};

export {
  userOrder,
  getUserOrder,
  getUserOrderById,
  getAllUserOrder,
  updateStatus,
};
