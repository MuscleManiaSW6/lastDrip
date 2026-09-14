import "dotenv/config";

import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../services/emailServices.js", () => ({
  orderConfirmationEmail: jest.fn(async (order) => ({
    to: order.user.email,
    subject: "lastDrip - Order Confirmation",
    html: "<p>Order confirmed</p>",
  })),

  paymentFailureEmail: jest.fn(async (order) => ({
    to: order.user.email,
    subject: "lastDrip - Payment Failed",
    html: "<p>Payment failed</p>",
  })),

  queueEmail: jest.fn(async () => ({
    _id: "mock-email-job",
  })),
}));

const { default: connectDB } = await import("../config/DB.js");

const { default: User } = await import("../models/User.js");
const { default: Order } = await import("../models/Orders.js");

const { env } = await import("../config/env.js");

const {
  verifyRazorpayPayment,
} = await import("../services/paymentServices.js");

jest.setTimeout(30000);

describe("Payment", () => {
  let user;
  let otherUser;

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

  const createPaymentOrder = async ({
    owner = user,
    razorpayOrderId,
    paymentStatus = "pending",
    inventoryStatus = "reserved",
  } = {}) => {
    const payment = {
      status: paymentStatus,
    };

    if (razorpayOrderId !== undefined) {
      payment.razorpayOrderId = razorpayOrderId;
    }

    return await Order.create({
      user: owner._id,

      idempotencyKey: `payment-test-${Date.now()}-${Math.random()}`,

      orderNumber: `LD-PAY-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,

      products: [
        {
          product: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId(),
          sku: "PAY-TEST-M",
          size: "M",
          color: "Black",
          name: "Payment Test T-Shirt",
          price: 1000,
          quantity: 1,
        },
      ],

      shippingAddress: {
        fullName: owner.name,
        phone: owner.phone,
        addressLine1: "123 Payment Street",
        addressLine2: "",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India",
      },

      totalPrice: 1000,

      status: "pending",

      payment,

      inventory: {
        status: inventoryStatus,
      },

      email: {
        orderConfirmationQueued: false,
      },
    });
  };

  const createSignature = (razorpayOrderId, razorpayPaymentId) => {
    return crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
  };

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await User.deleteMany({});

    user = await createUser(
      `payment-user-${Date.now()}-${Math.random()}@example.com`,
      "Payment User",
    );

    otherUser = await createUser(
      `payment-other-${Date.now()}-${Math.random()}@example.com`,
      "Other Payment User",
    );
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("verifies a valid payment and captures the order", async () => {
    const razorpayOrderId = `order_valid_${Date.now()}`;
    const razorpayPaymentId = `pay_valid_${Date.now()}`;

    const order = await createPaymentOrder({
      razorpayOrderId,
    });

    const signature = createSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );

    const result = await verifyRazorpayPayment(
      order._id,
      user._id,
      razorpayOrderId,
      razorpayPaymentId,
      signature,
    );

    expect(result._id.toString()).toBe(order._id.toString());

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("captured");

    expect(updatedOrder.payment.razorpayPaymentId).toBe(
      razorpayPaymentId,
    );

    expect(updatedOrder.inventory.status).toBe("allocated");

    expect(updatedOrder.email.orderConfirmationQueued).toBe(true);
  });

  test("rejects an invalid payment signature", async () => {
    const razorpayOrderId = `order_invalid_sig_${Date.now()}`;
    const razorpayPaymentId = `pay_invalid_sig_${Date.now()}`;

    const order = await createPaymentOrder({
      razorpayOrderId,
    });

    await expect(
      verifyRazorpayPayment(
        order._id,
        user._id,
        razorpayOrderId,
        razorpayPaymentId,
        "invalid_signature",
      ),
    ).rejects.toMatchObject({
      message: "INVALID_PAYMENT_SIGNATURE",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.payment.status).toBe("pending");
    expect(unchangedOrder.payment.razorpayPaymentId).toBeUndefined();
    expect(unchangedOrder.inventory.status).toBe("reserved");
  });

  test("rejects a payment when the Razorpay order ID does not match", async () => {
    const storedRazorpayOrderId = `order_stored_${Date.now()}`;
    const suppliedRazorpayOrderId = `order_wrong_${Date.now()}`;
    const razorpayPaymentId = `pay_mismatch_${Date.now()}`;

    const order = await createPaymentOrder({
      razorpayOrderId: storedRazorpayOrderId,
    });

    const signature = createSignature(
      suppliedRazorpayOrderId,
      razorpayPaymentId,
    );

    await expect(
      verifyRazorpayPayment(
        order._id,
        user._id,
        suppliedRazorpayOrderId,
        razorpayPaymentId,
        signature,
      ),
    ).rejects.toMatchObject({
      message: "RAZORPAY_ORDER_MISMATCH",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.payment.status).toBe("pending");
    expect(unchangedOrder.inventory.status).toBe("reserved");
  });

  test("rejects payment verification for an order belonging to another user", async () => {
    const razorpayOrderId = `order_other_user_${Date.now()}`;
    const razorpayPaymentId = `pay_other_user_${Date.now()}`;

    const order = await createPaymentOrder({
      owner: otherUser,
      razorpayOrderId,
    });

    const signature = createSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );

    await expect(
      verifyRazorpayPayment(
        order._id,
        user._id,
        razorpayOrderId,
        razorpayPaymentId,
        signature,
      ),
    ).rejects.toMatchObject({
      message: "ORDER_NOT_FOUND",
      statusCode: 404,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.payment.status).toBe("pending");
    expect(unchangedOrder.inventory.status).toBe("reserved");
  });

  test("rejects payment verification when the order does not exist", async () => {
    const nonexistentOrderId = new mongoose.Types.ObjectId();

    const razorpayOrderId = `order_nonexistent_${Date.now()}`;
    const razorpayPaymentId = `pay_nonexistent_${Date.now()}`;

    const signature = createSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );

    await expect(
      verifyRazorpayPayment(
        nonexistentOrderId,
        user._id,
        razorpayOrderId,
        razorpayPaymentId,
        signature,
      ),
    ).rejects.toMatchObject({
      message: "ORDER_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("rejects payment verification when the order has no Razorpay order ID", async () => {
    const order = await createPaymentOrder();

    await expect(
      verifyRazorpayPayment(
        order._id,
        user._id,
        "order_missing_from_database",
        `pay_no_order_id_${Date.now()}`,
        "any_signature",
      ),
    ).rejects.toMatchObject({
      message: "RAZORPAY_ORDER_NOT_FOUND",
      statusCode: 400,
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.payment.status).toBe("pending");
    expect(unchangedOrder.inventory.status).toBe("reserved");
  });

  test("handles duplicate payment verification safely", async () => {
    const razorpayOrderId = `order_duplicate_${Date.now()}`;
    const razorpayPaymentId = `pay_duplicate_${Date.now()}`;

    const order = await createPaymentOrder({
      razorpayOrderId,
    });

    const signature = createSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );

    const firstResult = await verifyRazorpayPayment(
      order._id,
      user._id,
      razorpayOrderId,
      razorpayPaymentId,
      signature,
    );

    expect(firstResult.payment.status).toBe("captured");

    const secondResult = await verifyRazorpayPayment(
      order._id,
      user._id,
      razorpayOrderId,
      razorpayPaymentId,
      signature,
    );

    expect(secondResult.payment.status).toBe("captured");

    expect(secondResult.payment.razorpayPaymentId).toBe(
      razorpayPaymentId,
    );

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("captured");
    expect(updatedOrder.payment.razorpayPaymentId).toBe(
      razorpayPaymentId,
    );
    expect(updatedOrder.inventory.status).toBe("allocated");
  });

  test("rejects a second payment ID after payment has already been captured", async () => {
    const razorpayOrderId = `order_second_payment_${Date.now()}`;
    const firstPaymentId = `pay_first_${Date.now()}`;
    const secondPaymentId = `pay_second_${Date.now()}`;

    const order = await createPaymentOrder({
      razorpayOrderId,
    });

    const firstSignature = createSignature(
      razorpayOrderId,
      firstPaymentId,
    );

    const firstResult = await verifyRazorpayPayment(
      order._id,
      user._id,
      razorpayOrderId,
      firstPaymentId,
      firstSignature,
    );

    expect(firstResult.payment.status).toBe("captured");

    const secondSignature = createSignature(
      razorpayOrderId,
      secondPaymentId,
    );

    await expect(
      verifyRazorpayPayment(
        order._id,
        user._id,
        razorpayOrderId,
        secondPaymentId,
        secondSignature,
      ),
    ).rejects.toMatchObject({
      message: "PAYMENT_ID_MISMATCH",
      statusCode: 400,
    });

    const finalOrder = await Order.findById(order._id);

    expect(finalOrder.payment.status).toBe("captured");

    expect(finalOrder.payment.razorpayPaymentId).toBe(
      firstPaymentId,
    );

    expect(finalOrder.inventory.status).toBe("allocated");
  });
});
