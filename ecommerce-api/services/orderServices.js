import Order from "../models/Orders.js";
import Product from "../models/Product.js";

//* POST(/)
const userOrder = async (userId, products) => {
  let totalPrice = 0;
  for (let i = 0; i < products.length; i++) {
    const product = await Product.findById(products[i].product);

    if (!product) {
      return null;
    }

    totalPrice += product.price * products[i].quantity;
  }

  const order = await Order.create({
    user: userId,
    products: products,
    totalPrice: totalPrice,
  });

  return order;
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
