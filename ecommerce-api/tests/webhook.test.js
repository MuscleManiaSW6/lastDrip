import "dotenv/config";

import request from "supertest";
import crypto from "crypto";
import mongoose from "mongoose";

import connectDB from "../config/DB.js";
import app from "../app.js";
import Product from "../models/Product.js";
import Order from "../models/Orders.js";

describe("Razorpay Webhook", () => {
  let order;
  let product;

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    product = await Product.create({
      name: "Webhook Test Product",
      price: 1000,
      description: "Product used for webhook testing",
      category: "Test",
      stock: 10,
    });

    order = await Order.create({
      user: new mongoose.Types.ObjectId(),
      products: [
        {
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ],
      totalPrice: 1000,
      payment: {
        status: "pending",
        razorpayOrderId: "order_webhook_test_123",
      },
    });
  });

  afterEach(async () => {
    await Order.findByIdAndDelete(order._id);
    await Product.findByIdAndDelete(product._id);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("processes a valid payment.captured webhook", async () => {
    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_test_123",
            order_id: "order_webhook_test_123",
            amount: 100000,
            status: "captured",
          },
        },
      },
    };

    const rawBody = JSON.stringify(body);

    const signature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET,
      )
      .update(rawBody)
      .digest("hex");

    const response = await request(app)
      .post("/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(rawBody);

    expect(response.status).toBe(200);

    const updatedOrder = await Order.findById(order._id);

    expect(updatedOrder.payment.status).toBe("captured");

    expect(updatedOrder.payment.razorpayPaymentId).toBe(
      "pay_webhook_test_123",
    );
  });

  test("rejects an invalid webhook signature", async () => {
    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_test_123",
            order_id: "order_webhook_test_123",
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
});