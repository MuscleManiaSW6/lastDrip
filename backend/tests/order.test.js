import "dotenv/config";

import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

const { default: connectDB } = await import("../config/DB.js");

const { default: User } = await import("../models/User.js");
const { default: Product } = await import("../models/Product.js");
const { default: Order } = await import("../models/Orders.js");

const {
  updateStatus,
  cancelOrder,
} = await import("../services/orderServices.js");

jest.setTimeout(30000);

describe("Order Lifecycle", () => {
  let user;
  let otherUser;
  let product;
  let variantId;

  const password = "TestPassword123!";

  const createUser = async (email, name) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    return await User.create({
      name,
      email,
      phone: "9876543210",
      password: hashedPassword,
      role: "user",
      status: "active",
    });
  };

  const createOrder = async ({
    owner = user,
    status = "pending",
    paymentStatus = "captured",
    inventoryStatus = "allocated",
  } = {}) => {
    return await Order.create({
      user: owner._id,

      idempotencyKey: `lifecycle-${Date.now()}-${Math.random()}`,

      orderNumber: `LD-LIFE-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,

      products: [
        {
          product: product._id,
          variantId,
          sku: product.variants[0].sku,
          size: product.variants[0].size,
          color: product.variants[0].color,
          name: product.name,
          price: product.variants[0].price,
          quantity: 1,
        },
      ],

      shippingAddress: {
        fullName: owner.name,
        phone: owner.phone,
        addressLine1: "123 Lifecycle Street",
        addressLine2: "",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India",
      },

      totalPrice: product.variants[0].price,

      status,

      payment: {
        status: paymentStatus,
      },

      inventory: {
        status: inventoryStatus,
      },

      email: {
        orderConfirmationQueued: true,
      },
    });
  };

  beforeAll(async () => {
    await connectDB();

    user = await createUser(
      `lifecycle-user-${Date.now()}-${Math.random()}@example.com`,
      "Lifecycle User",
    );

    otherUser = await createUser(
      `lifecycle-other-${Date.now()}-${Math.random()}@example.com`,
      "Other Lifecycle User",
    );
  });

  beforeEach(async () => {
    product = await Product.create({
      name: "Lifecycle Test T-Shirt",
      price: 1000,
      description: "Product used for order lifecycle testing",
      category: "Test",
      variants: [
        {
          sku: `LIFE-${Date.now()}-${Math.random()}`,
          size: "M",
          color: "Black",
          stock: 0,
          price: 1000,
        },
      ],
    });

    variantId = product.variants[0]._id;
  });

  afterEach(async () => {
    await Order.deleteMany({
      $or: [
        { user: user._id },
        { user: otherUser._id },
      ],
    });

    if (product) {
      await Product.findByIdAndDelete(product._id);
    }

    product = null;
    variantId = null;
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: {
        $in: [user._id, otherUser._id],
      },
    });

    await mongoose.connection.close();
  });

  test("moves a paid pending order to processing", async () => {
    const order = await createOrder({
      status: "pending",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const updatedOrder = await updateStatus(
      order._id,
      "processing",
    );

    expect(updatedOrder.status).toBe("processing");

    const storedOrder = await Order.findById(order._id);

    expect(storedOrder.status).toBe("processing");
    expect(storedOrder.payment.status).toBe("captured");
    expect(storedOrder.inventory.status).toBe("allocated");
  });

  test("rejects moving a pending order to processing when payment is not captured", async () => {
    const order = await createOrder({
      status: "pending",
      paymentStatus: "pending",
      inventoryStatus: "reserved",
    });

    await expect(
      updateStatus(order._id, "processing"),
    ).rejects.toMatchObject({
      message: "PAYMENT_NOT_CAPTURED",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
    expect(unchangedOrder.payment.status).toBe("pending");
    expect(unchangedOrder.inventory.status).toBe("reserved");
  });

  test("moves a processing order to shipped and records shipping information", async () => {
    const order = await createOrder({
      status: "processing",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const beforeUpdate = new Date();

    const updatedOrder = await updateStatus(
      order._id,
      "shipped",
      "Delhivery",
      "DLV123456789",
    );

    const afterUpdate = new Date();

    expect(updatedOrder.status).toBe("shipped");

    expect(updatedOrder.shipping.carrier).toBe("Delhivery");

    expect(updatedOrder.shipping.trackingNumber).toBe(
      "DLV123456789",
    );

    expect(updatedOrder.shipping.shippedAt).toBeInstanceOf(Date);

    expect(
      updatedOrder.shipping.shippedAt.getTime(),
    ).toBeGreaterThanOrEqual(beforeUpdate.getTime());

    expect(
      updatedOrder.shipping.shippedAt.getTime(),
    ).toBeLessThanOrEqual(afterUpdate.getTime());
  });

  test("moves a shipped order to delivered and records delivery time", async () => {
    const order = await createOrder({
      status: "shipped",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const beforeUpdate = new Date();

    const updatedOrder = await updateStatus(
      order._id,
      "delivered",
    );

    const afterUpdate = new Date();

    expect(updatedOrder.status).toBe("delivered");

    expect(updatedOrder.shipping.deliveredAt).toBeInstanceOf(Date);

    expect(
      updatedOrder.shipping.deliveredAt.getTime(),
    ).toBeGreaterThanOrEqual(beforeUpdate.getTime());

    expect(
      updatedOrder.shipping.deliveredAt.getTime(),
    ).toBeLessThanOrEqual(afterUpdate.getTime());
  });

  test("rejects an invalid status transition", async () => {
    const order = await createOrder({
      status: "pending",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    await expect(
      updateStatus(order._id, "shipped"),
    ).rejects.toMatchObject({
      message: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
  });

  test("does not allow a delivered order to change status", async () => {
    const order = await createOrder({
      status: "delivered",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    await expect(
      updateStatus(order._id, "processing"),
    ).rejects.toMatchObject({
      message: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    await expect(
      updateStatus(order._id, "cancelled"),
    ).rejects.toMatchObject({
      message: "INVALID_STATUS_TRANSITION",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("delivered");
  });

  test("cancels a pending order and releases its inventory", async () => {
    const order = await createOrder({
      status: "pending",
      paymentStatus: "pending",
      inventoryStatus: "reserved",
    });

    const cancelledOrder = await cancelOrder(
      order._id,
      user._id,
    );

    expect(cancelledOrder.status).toBe("cancelled");

    expect(cancelledOrder.inventory.status).toBe("released");

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(1);
  });

  test("cancels a processing order and releases its inventory", async () => {
    const order = await createOrder({
      status: "processing",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const cancelledOrder = await cancelOrder(
      order._id,
      user._id,
    );

    expect(cancelledOrder.status).toBe("cancelled");

    expect(cancelledOrder.inventory.status).toBe("released");

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(1);
  });

  test("does not allow a shipped order to be cancelled", async () => {
    const order = await createOrder({
      status: "shipped",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    await expect(
      cancelOrder(order._id, user._id),
    ).rejects.toMatchObject({
      message: "ORDER_CANNOT_BE_CANCELLED",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("shipped");
    expect(unchangedOrder.inventory.status).toBe("allocated");

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(0);
  });

  test("does not allow a delivered order to be cancelled", async () => {
    const order = await createOrder({
      status: "delivered",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    await expect(
      cancelOrder(order._id, user._id),
    ).rejects.toMatchObject({
      message: "ORDER_CANNOT_BE_CANCELLED",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("delivered");
    expect(unchangedOrder.inventory.status).toBe("allocated");

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(0);
  });

  test("does not allow one user to cancel another user's order", async () => {
    const order = await createOrder({
      owner: otherUser,
      status: "pending",
      paymentStatus: "pending",
      inventoryStatus: "reserved",
    });

    await expect(
      cancelOrder(order._id, user._id),
    ).rejects.toMatchObject({
      message: "ORDER_NOT_FOUND",
      statusCode: 404,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
    expect(unchangedOrder.inventory.status).toBe("reserved");

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(0);
  });

  test("rejects updating a nonexistent order", async () => {
    const nonexistentOrderId = new mongoose.Types.ObjectId();

    await expect(
      updateStatus(nonexistentOrderId, "processing"),
    ).rejects.toMatchObject({
      message: "ORDER_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("rejects cancelling a nonexistent order", async () => {
    const nonexistentOrderId = new mongoose.Types.ObjectId();

    await expect(
      cancelOrder(nonexistentOrderId, user._id),
    ).rejects.toMatchObject({
      message: "ORDER_NOT_FOUND",
      statusCode: 404,
    });
  });
});