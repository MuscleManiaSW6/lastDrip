import "dotenv/config";

import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/razorpay.js", () => ({
  default: {
    orders: {
      create: jest.fn(async (options) => ({
        id: `order_${options.receipt}`,
        amount: options.amount,
        currency: options.currency,
        receipt: options.receipt,
      })),
    },
  },
}));

jest.unstable_mockModule("../services/emailServices.js", () => ({
  orderConfirmationEmail: jest.fn(async (order) => ({
    to: order.user.email,
    subject: "Order Confirmation",
    html: "<p>Order confirmed</p>",
  })),

  paymentFailureEmail: jest.fn(async (order) => ({
    to: order.user.email,
    subject: "Payment Failed",
    html: "<p>Payment failed</p>",
  })),

  queueEmail: jest.fn(async () => {}),
  sendEmail: jest.fn(async () => {}),
}));

const { default: request } = await import("supertest");
const { default: mongoose } = await import("mongoose");
const { default: app } = await import("../app.js");
const { default: connectDB } = await import("../config/DB.js");
const { default: User } = await import("../models/User.js");
const { default: Product } = await import("../models/Product.js");
const { default: Cart } = await import("../models/Cart.js");
const { default: Order } = await import("../models/Orders.js");
const { handlePaymentFailed } = await import(
  "../services/paymentServices.js"
);

jest.setTimeout(30000);

describe("Inventory", () => {
  let product;
  let variantId;

  let userA;
  let userB;

  let tokenA;
  let tokenB;

  let addressIdA;
  let addressIdB;

  const password = "TestPassword123!";

  const createUser = async (label) => {
    const email = `inventory-${label}-${Date.now()}-${Math.random()}@example.com`;

    const registerResponse = await request(app)
      .post("/users/register")
      .send({
        name: `Inventory User ${label}`,
        email,
        password,
        phone: "9876543210",
      });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post("/users/login")
      .send({
        email,
        password,
      });

    expect(loginResponse.status).toBe(200);

    const user = await User.findOne({ email });

    return {
      user,
      token: loginResponse.body.token,
    };
  };

  const createAddress = async (token) => {
    const response = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Inventory Test User",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India",
        isDefault: true,
      });

    expect(response.status).toBe(201);

    return response.body.address._id;
  };

  beforeAll(async () => {
    await connectDB();

    const firstUser = await createUser("A");
    const secondUser = await createUser("B");

    userA = firstUser.user;
    tokenA = firstUser.token;

    userB = secondUser.user;
    tokenB = secondUser.token;

    addressIdA = await createAddress(tokenA);
    addressIdB = await createAddress(tokenB);
  });

  beforeEach(async () => {
    product = await Product.create({
      name: "Inventory Test Product",
      price: 1000,
      description: "Product used for inventory testing",
      category: "Test",
      variants: [
        {
          sku: `TEST-${Date.now()}-${Math.random()}`,
          size: "M",
          color: "Black",
          stock: 1,
          price: 1000,
        },
      ],
    });

    variantId = product.variants[0]._id;

    await Cart.create({
      user: userA._id,
      items: [
        {
          product: product._id,
          variantId,
          quantity: 1,
        },
      ],
    });

    await Cart.create({
      user: userB._id,
      items: [
        {
          product: product._id,
          variantId,
          quantity: 1,
        },
      ],
    });
  });

  afterEach(async () => {
    if (!product) {
      return;
    }

    await Order.deleteMany({
      "products.product": product._id,
    });

    await Cart.deleteMany({
      user: {
        $in: [userA._id, userB._id],
      },
    });

    await Product.findByIdAndDelete(product._id);

    product = null;
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: {
        $in: [userA._id, userB._id],
      },
    });

    await mongoose.connection.close();
  });

  test("only one simultaneous checkout can purchase the last item", async () => {
    const requestA = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", `inventory-a-${Date.now()}`)
      .send({
        addressId: addressIdA.toString(),
      });

    const requestB = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("Idempotency-Key", `inventory-b-${Date.now()}`)
      .send({
        addressId: addressIdB.toString(),
      });

    const [responseA, responseB] = await Promise.all([
      requestA,
      requestB,
    ]);

    const statuses = [responseA.status, responseB.status].sort();

    expect(statuses).toEqual([201, 400]);

    const finalProduct = await Product.findById(product._id);

    expect(finalProduct.variants[0].stock).toBe(0);

    const orders = await Order.find({
      "products.product": product._id,
    });

    expect(orders).toHaveLength(1);

    expect(orders[0].products).toHaveLength(1);

    expect(
      orders[0].products[0].variantId.toString(),
    ).toBe(variantId.toString());

    expect(orders[0].products[0].quantity).toBe(1);

    expect(orders[0].inventory.status).toBe("reserved");

    expect(orders[0].payment.status).toBe("pending");
  });

  test("restores inventory when payment fails", async () => {
    const checkoutResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", `inventory-payment-failure-${Date.now()}`)
      .send({
        addressId: addressIdA.toString(),
      });

    expect(checkoutResponse.status).toBe(201);

    const orderId = checkoutResponse.body._id;

    const reservedProduct = await Product.findById(product._id);

    expect(reservedProduct.variants[0].stock).toBe(0);

    const reservedOrder = await Order.findById(orderId);

    expect(reservedOrder).not.toBeNull();

    expect(reservedOrder.inventory.status).toBe("reserved");

    expect(reservedOrder.payment.status).toBe("pending");

    await handlePaymentFailed(reservedOrder);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(1);

    const updatedOrder = await Order.findById(orderId);

    expect(updatedOrder.payment.status).toBe("failed");

    expect(updatedOrder.inventory.status).toBe("released");
  });

  test("restores inventory when a pending order is cancelled", async () => {
    const checkoutResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", `inventory-cancellation-${Date.now()}`)
      .send({
        addressId: addressIdA.toString(),
      });

    expect(checkoutResponse.status).toBe(201);

    const orderId = checkoutResponse.body._id;

    const reservedProduct = await Product.findById(product._id);

    expect(reservedProduct.variants[0].stock).toBe(0);

    const reservedOrder = await Order.findById(orderId);

    expect(reservedOrder).not.toBeNull();

    expect(reservedOrder.status).toBe("pending");

    expect(reservedOrder.inventory.status).toBe("reserved");

    expect(reservedOrder.payment.status).toBe("pending");

    const cancelResponse = await request(app)
      .patch(`/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(cancelResponse.status).toBe(200);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(1);

    const updatedOrder = await Order.findById(orderId);

    expect(updatedOrder.status).toBe("cancelled");

    expect(updatedOrder.inventory.status).toBe("released");

    expect(updatedOrder.payment.status).toBe("pending");
  });
});