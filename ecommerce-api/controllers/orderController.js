import {
  getAllUserOrder,
  getUserOrder,
  getUserOrderById,
  updateStatus,
  userOrder,
} from "../services/orderServices.js";

//* POST(/)
const orderProduct = async (req, res) => {
  try {
    const { userId } = req.user;
    const { products } = req.body;

    const order = await userOrder(userId, products);

    return res.status(201).json(order);
  } catch (err) {
    if (err.message === "PRODUCT_NOT_FOUND") {
      return res
        .status(404)
        .json({ message: "One or more product were not found" });
    }

    if (err.message === "INSUFFICIENT_STOCK") {
      return res.status(409).json({ message: "INSUFFICIENT_STOCK" });
    }

    console.error(err);

    return res.status(500).json({ message: "Failed to create order" });
  }
};

//* GET(/)
const getOrders = async (req, res) => {
  const { userId } = req.user;

  const orders = await getUserOrder(userId);

  return res.status(200).json(orders);
};

//* GET(/:id)
const getOrdersById = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const orders = await getUserOrderById(id, userId);

  if (!orders) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.status(200).json(orders);
};

//* GET(/admin)
const getAllOrders = async (req, res) => {
  const orders = await getAllUserOrder();

  if (orders.length === 0) {
    return res.status(404).json({ message: "No orders found" });
  }

  return res.status(200).json(orders);
};

//* PATCH(/:id/status)
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await updateStatus(id, status);

  if (!updated) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.status(200).json(updated);
};

export {
  orderProduct,
  getOrders,
  getOrdersById,
  getAllOrders,
  updateOrderStatus,
};
