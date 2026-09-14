import "dotenv/config";

import request from "supertest";
import crypto from "crypto";
import mongoose from "mongoose";

import connectDB from "../config/DB.js";
import app from "../app.js";

import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Orders.js";
import EmailJob from "../models/EmailJob.js";
import ProcessedWebhook from "../models/processedWebhook.js";

describe("Razorpay Webhook", () => {
  let user;
  let product;
  let order;

  const createSignature = (rawBody) => {
    return crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET,
      )
      .update(rawBody)
      .digest("hex");
  };

  beforeAll(async () => {
    await connectDB();

    user = await User.create({
      name: "Webhook Test User",
      email: `webhook-test-${Date.now()}@example.com`,
      phone: "9876543210",
      password: "hashed-password",
    });
  });

  beforeEach(async () => {
    product = await Product.create({
      name: "Webhook Test Product",
      price: 1000,
      description: "Product used for webhook testing",
      category: "Test",
      variants: [
        {
          sku: `WEBHOOK-${Date.now()}`,
          size: "M",
          color: "Black",
          stock: 0,
          price: 1000,
        },
      ],
    });

    const variant = product.variants[0];

    order = await Order.create({
      user: user._id,

      idempotencyKey: `webhook-test-${Date.now()}-${Math.random()}`,

      orderNumber: `LD-WEBHOOK-${Date.now()}-${Math.floor(
        Math.random() * 10000,
      )}`,

      products: [
        {
          product: product._id,
          variantId: variant._id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          name: product.name,
          price: variant.price,
          quantity: 1,
        },
      ],

      shippingAddress: {
        fullName: "Webhook Test User",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        addressLine2: "",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India",
      },

      totalPrice: 1000,

      payment: {
        status: "pending",
        razorpayOrderId: `order_webhook_${Date.now()}`,
      },

      inventory: {
        status: "reserved",
      },
    });
  });

  afterEach(async () => {
    await EmailJob.deleteMany({});
    await ProcessedWebhook.deleteMany({
      provider: "razorpay",
    });

    if (order) {
      await Order.findByIdAndDelete(order._id);
    }

    if (product) {
      await Product.findByIdAndDelete(product._id);
    }
  });

  afterAll(async () => {
    await User.findByIdAndDelete(user._id);
    await mongoose.connection.close();
  });

  test("processes a valid payment.captured webhook", async () => {
    const body = {
      id: `evt_captured_${Date.now()}`,
      event: "payment.captured",

      payload: {
        payment: {
          entity: {
            id: "pay_webhook_test_123",
            order_id: order.payment.razorpayOrderId,
            amount: 100000,
            status: "captured",
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);
    const signature = createSignature(rawBody);

    const response = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      received: true,
    });

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("captured");

    expect(updatedOrder.payment.razorpayPaymentId).toBe(
      "pay_webhook_test_123",
    );

    expect(updatedOrder.inventory.status).toBe("allocated");

    const webhookEvent = await ProcessedWebhook.findOne({
      eventId: body.id,
      provider: "razorpay",
    });

    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent.status).toBe("completed");
  });

  test("processes a payment.failed webhook and releases inventory", async () => {
    const body = {
      id: `evt_failed_${Date.now()}`,
      event: "payment.failed",

      payload: {
        payment: {
          entity: {
            id: "pay_webhook_failed_123",
            order_id: order.payment.razorpayOrderId,
            amount: 100000,
            status: "failed",
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);
    const signature = createSignature(rawBody);

    const response = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(response.status).toBe(200);

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("failed");

    expect(updatedOrder.inventory.status).toBe("released");

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(1);

    const webhookEvent = await ProcessedWebhook.findOne({
      eventId: body.id,
      provider: "razorpay",
    });

    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent.status).toBe("completed");
  });

  test("does not process the same webhook event twice", async () => {
    const body = {
      id: `evt_duplicate_${Date.now()}`,
      event: "payment.failed",

      payload: {
        payment: {
          entity: {
            id: "pay_webhook_duplicate_123",
            order_id: order.payment.razorpayOrderId,
            amount: 100000,
            status: "failed",
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);
    const signature = createSignature(rawBody);

    const firstResponse = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(firstResponse.status).toBe(200);

    const productAfterFirstWebhook = await Product.findById(product._id);

    expect(productAfterFirstWebhook.variants[0].stock).toBe(1);

    const secondResponse = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(secondResponse.status).toBe(200);

    const productAfterSecondWebhook = await Product.findById(product._id);

    expect(productAfterSecondWebhook.variants[0].stock).toBe(1);

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("failed");

    expect(updatedOrder.inventory.status).toBe("released");

    const webhookEvents = await ProcessedWebhook.find({
      eventId: body.id,
      provider: "razorpay",
    });

    expect(webhookEvents).toHaveLength(1);
  });

  test("rejects an invalid webhook signature", async () => {
    const body = {
      id: `evt_invalid_${Date.now()}`,
      event: "payment.captured",

      payload: {
        payment: {
          entity: {
            id: "pay_invalid_signature",
            order_id: order.payment.razorpayOrderId,
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);

    const response = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "invalid_signature")
      .send(rawBody);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "INVALID_WEBHOOK_SIGNATURE",
    });
  });

  test("rejects a webhook without an event ID", async () => {
    const body = {
      event: "payment.captured",

      payload: {
        payment: {
          entity: {
            id: "pay_missing_event_id",
            order_id: order.payment.razorpayOrderId,
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);
    const signature = createSignature(rawBody);

    const response = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "WEBHOOK_EVENT_ID_MISSING",
    });
  });
});