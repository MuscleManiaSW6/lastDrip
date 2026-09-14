import {
  cancelOrder,
  getAllUserOrder,
  getUserOrder,
  getUserOrderById,
  updateStatus,
  userOrder,
} from "../services/orderServices.js";

//* POST(/)
const orderProduct = async (req, res) => {
  const { userId } = req.user;
  const { addressId } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey) {
    const err = new Error("IDEMPOTENCY_KEY_REQUIRED");
    err.statusCode = 400;
    throw err;
  }

  if (!addressId) {
    const err = new Error("ADDRESS_ID_REQUIRED");
    err.statusCode = 400;
    throw err;
  }

  const order = await userOrder(userId, idempotencyKey, addressId);

  return res.status(201).json(order);
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
  const { status, carrier, trackingNumber } = req.body;

  const updated = await updateStatus(id, status, carrier, trackingNumber);

  if (!updated) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.status(200).json(updated);
};

//* PATCH (/:id/cancel)
const cancelUserOrder = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  const cancelledOrder = await cancelOrder(id, userId);

  return res.status(200).json(cancelledOrder);
};

export {
  orderProduct,
  getOrders,
  getOrdersById,
  getAllOrders,
  updateOrderStatus,
  cancelUserOrder,
};
