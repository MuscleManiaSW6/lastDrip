import "dotenv/config";

import request from "supertest";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

import connectDB from "../config/DB.js";
import app from "../app.js";

import Product from "../models/Product.js";
import Order from "../models/Orders.js";

jest.setTimeout(15000);

describe("Inventory concurrency", () => {
  let product;
  let token;

  beforeAll(async () => {
    await connectDB();

    const email = `inventory-test-${Date.now()}@example.com`;
    const password = "TestPassword123!";

    const registerResponse = await request(app).post("/auth/register").send({
      name: "Inventory Test User",
      email,
      password,
    });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app).post("/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);

    token = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Create a product with exactly ONE item available.
    product = await Product.create({
      name: "Concurrency Test Product",
      price: 1000,
      description: "Product used for inventory concurrency testing",
      category: "Test",
      stock: 1,
    });
  });

  afterEach(async () => {
    if (!product) {
      return;
    }

    await Order.deleteMany({
      "products.product": product._id,
    });

    await Product.findByIdAndDelete(product._id);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("only one simultaneous order can purchase the last item", async () => {
    const requestA = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        products: [
          {
            product: product._id.toString(),
            quantity: 1,
          },
        ],
      });

    const requestB = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        products: [
          {
            product: product._id.toString(),
            quantity: 1,
          },
        ],
      });

    const [responseA, responseB] = await Promise.all([requestA, requestB]);

    console.log("Request A:", responseA.status, responseA.body);
    console.log("Request B:", responseB.status, responseB.body);

    const statuses = [responseA.status, responseB.status].sort();

    // Exactly one request should succeed
    // and the other should fail because stock is gone.
    expect(statuses).toEqual([201, 409]);

    // Only one unit existed, so final stock must be zero.
    const finalProduct = await Product.findById(product._id);

    expect(finalProduct.stock).toBe(0);

    // Exactly one order should have been created.
    const orders = await Order.find({
      "products.product": product._id,
    });

    expect(orders).toHaveLength(1);
  });
});
