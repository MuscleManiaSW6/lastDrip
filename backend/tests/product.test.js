import "dotenv/config";

import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

import connectDB from "../config/DB.js";
import app from "../app.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

import { env } from "../config/env.js";

jest.setTimeout(30000);

describe("Product API", () => {
  let adminUser;
  let normalUser;

  let adminToken;
  let userToken;

  const password = "TestPassword123!";

  const createUser = async (role, label) => {
    const email = `product-${label}-${Date.now()}-${Math.random()}@example.com`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: `Product ${label} User`,
      email,
      phone: "9876543210",
      password: hashedPassword,
      role,
      status: "active",
    });

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    return {
      user,
      token,
    };
  };

  const createProduct = async ({
    name = "Test T-Shirt",
    price = 1000,
    category = "T-Shirts",
    isActive = true,
  } = {}) => {
    return Product.create({
      name,
      price,
      description: `${name} description`,
      category,
      isActive,
      images: [
        {
          url: "https://example.com/test-shirt.jpg",
          alt: `${name} image`,
        },
      ],
      variants: [
        {
          sku: `SKU-${Date.now()}-${Math.random()}`,
          size: "M",
          color: "Black",
          stock: 10,
          price: 1000,
        },
        {
          sku: `SKU-${Date.now()}-${Math.random()}-L`,
          size: "L",
          color: "Black",
          stock: 5,
          price: 1100,
        },
      ],
    });
  };

  const productPayload = ({
    name = "New Test T-Shirt",
    price = 1500,
    category = "T-Shirts",
  } = {}) => ({
    name,
    price,
    description: `${name} description`,
    category,
    images: [
      {
        url: "https://example.com/new-shirt.jpg",
        alt: "New shirt image",
      },
    ],
    variants: [
      {
        sku: `NEW-${Date.now()}-${Math.random()}`,
        size: "M",
        color: "White",
        stock: 20,
        price: 1500,
      },
      {
        sku: `NEW-${Date.now()}-${Math.random()}-L`,
        size: "L",
        color: "White",
        stock: 15,
        price: 1600,
      },
    ],
  });

  beforeAll(async () => {
    await connectDB();

    const admin = await createUser("admin", "admin");
    const user = await createUser("user", "normal");

    adminUser = admin.user;
    adminToken = admin.token;

    normalUser = user.user;
    userToken = user.token;
  });

  afterEach(async () => {
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: {
        $in: [adminUser._id, normalUser._id],
      },
    });

    await mongoose.connection.close();
  });

  // ---------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------

  test("creates a product as an admin", async () => {
    const payload = productPayload();

    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(response.status).toBe(201);

    expect(response.body.name).toBe(payload.name);
    expect(response.body.price).toBe(payload.price);
    expect(response.body.description).toBe(payload.description);
    expect(response.body.category).toBe(payload.category);

    expect(response.body.variants).toHaveLength(2);
    expect(response.body.images).toHaveLength(1);
    expect(response.body.isActive).toBe(true);

    expect(response.body.variants[0].stock).toBe(20);
    expect(response.body.variants[1].stock).toBe(15);

    const product = await Product.findById(response.body._id);

    expect(product).not.toBeNull();
    expect(product.name).toBe(payload.name);
    expect(product.variants[0].stock).toBe(20);
    expect(product.variants[1].stock).toBe(15);
  });

  test("rejects product creation without authentication", async () => {
    const response = await request(app)
      .post("/products")
      .send(productPayload());

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("rejects product creation by a normal user", async () => {
    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send(productPayload());

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Forbidden",
    });
  });

  test("rejects invalid product creation data", async () => {
    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "",
        price: -100,
        description: "",
        category: "",
        variants: [],
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toEqual(expect.any(String));

    const products = await Product.find({});

    expect(products).toHaveLength(0);
  });

  // ---------------------------------------------------------
  // GET
  // ---------------------------------------------------------

  test("gets only active products from the public product list", async () => {
    const activeProduct = await createProduct({
      name: "Active Product",
      isActive: true,
    });

    const inactiveProduct = await createProduct({
      name: "Inactive Product",
      isActive: false,
    });

    const response = await request(app).get("/products");

    expect(response.status).toBe(200);

    expect(response.body.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: activeProduct._id.toString(),
          name: "Active Product",
        }),
      ]),
    );

    expect(
      response.body.products.some(
        (product) => product._id === inactiveProduct._id.toString(),
      ),
    ).toBe(false);
  });

  test("gets an active product by ID", async () => {
    const product = await createProduct({
      name: "Single Product",
    });

    const response = await request(app).get(`/products/${product._id}`);

    expect(response.status).toBe(200);

    expect(response.body._id).toBe(product._id.toString());
    expect(response.body.name).toBe("Single Product");
    expect(response.body.isActive).toBe(true);
  });

  test("does not return an inactive product by ID", async () => {
    const product = await createProduct({
      name: "Hidden Product",
      isActive: false,
    });

    const response = await request(app).get(`/products/${product._id}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product not found",
    });
  });

  test("rejects an invalid product ID", async () => {
    const response = await request(app).get("/products/not-a-valid-id");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("returns 404 for a nonexistent product ID", async () => {
    const nonexistentId = new mongoose.Types.ObjectId();

    const response = await request(app).get(`/products/${nonexistentId}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product not found",
    });
  });

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------

  test("searches products by name", async () => {
    await createProduct({
      name: "Black Oversized Hoodie",
    });

    await createProduct({
      name: "White Summer Shirt",
    });

    const response = await request(app).get("/products/search").query({
      name: "hoodie",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Black Oversized Hoodie");
  });

  test("searches products by exact price", async () => {
    await createProduct({
      name: "Cheap Product",
      price: 800,
    });

    await createProduct({
      name: "Expensive Product",
      price: 1800,
    });

    const response = await request(app).get("/products/search").query({
      price: 800,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Cheap Product");
  });

  test("does not return inactive products in search results", async () => {
    await createProduct({
      name: "Visible Hoodie",
      isActive: true,
    });

    await createProduct({
      name: "Hidden Hoodie",
      isActive: false,
    });

    const response = await request(app).get("/products/search").query({
      name: "hoodie",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Visible Hoodie");
  });

  test("returns 404 when product search finds nothing", async () => {
    const response = await request(app).get("/products/search").query({
      name: "does-not-exist",
    });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product not found",
    });
  });

  // ---------------------------------------------------------
  // PUT
  // ---------------------------------------------------------

  test("updates a product completely with PUT as an admin", async () => {
    const product = await createProduct({
      name: "Old Product",
      price: 1000,
    });

    const payload = productPayload({
      name: "Completely Replaced Product",
      price: 2000,
      category: "Hoodies",
    });

    const response = await request(app)
      .put(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(response.status).toBe(200);

    expect(response.body.name).toBe("Completely Replaced Product");
    expect(response.body.price).toBe(2000);
    expect(response.body.category).toBe("Hoodies");

    expect(response.body.variants).toHaveLength(2);
    expect(response.body.images).toHaveLength(1);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.name).toBe("Completely Replaced Product");
    expect(updatedProduct.price).toBe(2000);
  });

  test("preserves existing stock when replacing a product with PUT", async () => {
    const product = await createProduct({
      name: "Stock Protected Product",
    });

    const existingVariant = product.variants[0];
    const existingVariantId = existingVariant._id.toString();

    const originalStock = existingVariant.stock;

    const payload = {
      name: "Replaced Stock Protected Product",
      price: 1800,
      description: "Updated product description",
      category: "Hoodies",
      images: [
        {
          url: "https://example.com/replaced-shirt.jpg",
          alt: "Replaced shirt",
        },
      ],
      variants: [
        {
          _id: existingVariantId,
          sku: "UPDATED-SKU",
          size: existingVariant.size,
          color: existingVariant.color,
          price: 1800,
          stock: 999,
        },
        {
          sku: "NEW-VARIANT-SKU",
          size: "XL",
          color: "Black",
          price: 1900,
          stock: 500,
        },
      ],
    };

    const response = await request(app)
      .put(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(response.status).toBe(200);

    const updatedProduct = await Product.findById(product._id);

    const updatedExistingVariant =
      updatedProduct.variants.id(existingVariantId);

    const newVariant = updatedProduct.variants.find(
      (variant) => variant.sku === "NEW-VARIANT-SKU",
    );

    expect(updatedExistingVariant.stock).toBe(originalStock);
    expect(newVariant.stock).toBe(0);
  });

  test("rejects product replacement by a normal user", async () => {
    const product = await createProduct();

    const response = await request(app)
      .put(`/products/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send(productPayload());

    expect(response.status).toBe(403);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.name).toBe("Test T-Shirt");
  });

  // ---------------------------------------------------------
  // PATCH PRODUCT
  // ---------------------------------------------------------

  test("partially updates a product with PATCH", async () => {
    const product = await createProduct({
      name: "Original Product",
      price: 1000,
      category: "T-Shirts",
    });

    const response = await request(app)
      .patch(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Updated Product",
        price: 1300,
      });

    expect(response.status).toBe(200);

    expect(response.body.name).toBe("Updated Product");
    expect(response.body.price).toBe(1300);
    expect(response.body.description).toBe("Original Product description");
    expect(response.body.category).toBe("T-Shirts");
  });

  test("preserves existing stock when updating variants with PATCH", async () => {
    const product = await createProduct({
      name: "Patch Stock Protected Product",
    });

    const existingVariant = product.variants[0];
    const existingVariantId = existingVariant._id.toString();

    const originalStock = existingVariant.stock;

    const response = await request(app)
      .patch(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        variants: [
          {
            _id: existingVariantId,
            sku: "PATCHED-SKU",
            size: existingVariant.size,
            color: "White",
            price: 1200,
            stock: 999,
          },
          {
            sku: "PATCH-NEW-VARIANT",
            size: "XL",
            color: "White",
            price: 1300,
            stock: 500,
          },
        ],
      });

    expect(response.status).toBe(200);

    const updatedProduct = await Product.findById(product._id);

    const updatedExistingVariant =
      updatedProduct.variants.id(existingVariantId);

    const newVariant = updatedProduct.variants.find(
      (variant) => variant.sku === "PATCH-NEW-VARIANT",
    );

    expect(updatedExistingVariant.stock).toBe(originalStock);
    expect(newVariant.stock).toBe(0);
  });

  test("can deactivate a product using PATCH", async () => {
    const product = await createProduct({
      name: "Product To Deactivate",
      isActive: true,
    });

    const response = await request(app)
      .patch(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);

    const publicResponse = await request(app).get(`/products/${product._id}`);

    expect(publicResponse.status).toBe(404);
  });

  test("rejects an empty PATCH request", async () => {
    const product = await createProduct();

    const response = await request(app)
      .patch(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Please provide a field to update");
  });

  // ---------------------------------------------------------
  // STOCK
  // ---------------------------------------------------------

  test("increases variant stock through the dedicated stock endpoint", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 7,
      });

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(variantId);
    expect(response.body.stock).toBe(17);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(17);
  });

  test("decreases variant stock through the dedicated stock endpoint", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: -4,
      });

    expect(response.status).toBe(200);
    expect(response.body.stock).toBe(6);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(6);
  });

  test("supports increasing and decreasing stock sequentially", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const increaseResponse = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 7,
      });

    expect(increaseResponse.status).toBe(200);
    expect(increaseResponse.body.stock).toBe(17);

    const decreaseResponse = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: -5,
      });

    expect(decreaseResponse.status).toBe(200);
    expect(decreaseResponse.body.stock).toBe(12);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants[0].stock).toBe(12);
  });

  test("rejects a stock adjustment that would make stock negative", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: -11,
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product or variant not found",
    });

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(10);
  });

  test("rejects stock updates without authentication", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .send({
        adjustment: 5,
      });

    expect(response.status).toBe(401);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(10);
  });

  test("rejects stock updates by a normal user", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        adjustment: 5,
      });

    expect(response.status).toBe(403);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(10);
  });

  test("rejects an invalid stock adjustment", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 2.5,
      });

    expect(response.status).toBe(400);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(10);
  });

  test("rejects an invalid product ID for stock updates", async () => {
    const product = await createProduct();

    const variantId = product.variants[0]._id.toString();

    const response = await request(app)
      .patch(`/products/not-a-valid-id/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 5,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("rejects an invalid variant ID for stock updates", async () => {
    const product = await createProduct();

    const response = await request(app)
      .patch(`/products/${product._id}/variants/not-a-valid-id/stock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 5,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("returns 404 when the stock update targets a nonexistent variant", async () => {
    const product = await createProduct();

    const nonexistentVariantId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(
        `/products/${product._id}/variants/${nonexistentVariantId}/stock`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        adjustment: 5,
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product or variant not found",
    });
  });

  // ---------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------

  test("soft deletes an active product as an admin", async () => {
    const product = await createProduct({
      name: "Product To Delete",
    });

    const response = await request(app)
      .delete(`/products/${product._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: "Product removed successfully",
    });

    const deletedProduct = await Product.findById(product._id);

    expect(deletedProduct).not.toBeNull();
    expect(deletedProduct.isActive).toBe(false);
  });

  test("rejects product deletion by a normal user", async () => {
    const product = await createProduct();

    const response = await request(app)
      .delete(`/products/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct).not.toBeNull();
    expect(unchangedProduct.isActive).toBe(true);
  });

  test("returns 404 when deleting a nonexistent product", async () => {
    const nonexistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/products/${nonexistentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Product not found",
    });
  });

  // ---------------------------------------------------------
  // PAGINATION / SORTING
  // ---------------------------------------------------------

  test("supports pagination for product listing", async () => {
    await createProduct({
      name: "Product One",
    });

    await createProduct({
      name: "Product Two",
    });

    await createProduct({
      name: "Product Three",
    });

    const response = await request(app).get("/products").query({
      page: 2,
      limit: 2,
    });

    expect(response.status).toBe(200);

    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBe(3);
    expect(response.body.totalPages).toBe(2);
    expect(response.body.products).toHaveLength(1);
  });

  test("supports price ascending sorting", async () => {
    await createProduct({
      name: "Expensive Product",
      price: 3000,
    });

    await createProduct({
      name: "Cheap Product",
      price: 500,
    });

    await createProduct({
      name: "Medium Product",
      price: 1500,
    });

    const response = await request(app).get("/products").query({
      sort: "priceAsc",
    });

    expect(response.status).toBe(200);

    expect(response.body.products[0].name).toBe("Cheap Product");
    expect(response.body.products[1].name).toBe("Medium Product");
    expect(response.body.products[2].name).toBe("Expensive Product");
  });

  test("rejects an invalid product query", async () => {
    const response = await request(app).get("/products").query({
      page: 0,
      limit: 100,
    });

    expect(response.status).toBe(400);

    expect(response.body.message).toEqual(expect.any(String));
  });
});