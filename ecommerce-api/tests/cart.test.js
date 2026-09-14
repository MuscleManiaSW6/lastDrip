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
import Cart from "../models/Cart.js";

import { env } from "../config/env.js";

jest.setTimeout(30000);

describe("Cart API", () => {
  let user;
  let otherUser;

  let userToken;
  let otherUserToken;

  const password = "TestPassword123!";

  const createUser = async (label) => {
    const email = `cart-${label}-${Date.now()}-${Math.random()}@example.com`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const createdUser = await User.create({
      name: `Cart ${label} User`,
      email,
      phone: "9876543210",
      password: hashedPassword,
      role: "user",
      status: "active",
    });

    const token = jwt.sign(
      {
        userId: createdUser._id,
        email: createdUser.email,
        role: createdUser.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    return {
      user: createdUser,
      token,
    };
  };

  const createProduct = async ({
    name = "Cart Test T-Shirt",
    isActive = true,
    firstVariantStock = 10,
    secondVariantStock = 5,
  } = {}) => {
    return await Product.create({
      name,
      price: 1000,
      description: `${name} description`,
      category: "T-Shirts",
      isActive,
      images: [
        {
          url: "https://example.com/cart-test-shirt.jpg",
          alt: `${name} image`,
        },
      ],
      variants: [
        {
          sku: `CART-${Date.now()}-${Math.random()}`,
          size: "M",
          color: "Black",
          stock: firstVariantStock,
          price: 1000,
        },
        {
          sku: `CART-${Date.now()}-${Math.random()}-L`,
          size: "L",
          color: "Black",
          stock: secondVariantStock,
          price: 1100,
        },
      ],
    });
  };

  const addItem = async ({
    token = userToken,
    productId,
    variantId,
    quantity = 1,
  }) => {
    return await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        products: [
          {
            product: productId.toString(),
            variantId: variantId.toString(),
            quantity,
          },
        ],
      });
  };

  beforeAll(async () => {
    await connectDB();

    const firstUser = await createUser("primary");
    const secondUser = await createUser("secondary");

    user = firstUser.user;
    userToken = firstUser.token;

    otherUser = secondUser.user;
    otherUserToken = secondUser.token;
  });

  afterEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: {
        $in: [user._id, otherUser._id],
      },
    });

    await mongoose.connection.close();
  });

  test("returns an empty cart for a new user", async () => {
    const response = await request(app)
      .get("/cart")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      items: [],
    });
  });

  test("rejects getting the cart without authentication", async () => {
    const response = await request(app).get("/cart");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("adds an item to the cart", async () => {
    const product = await createProduct();

    const variant = product.variants[0];

    const response = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    expect(response.status).toBe(201);

    expect(response.body.user).toBe(user._id.toString());
    expect(response.body.items).toHaveLength(1);

    expect(response.body.items[0].product).toBe(product._id.toString());
    expect(response.body.items[0].variantId).toBe(variant._id.toString());
    expect(response.body.items[0].quantity).toBe(2);

    const cart = await Cart.findOne({ user: user._id });

    expect(cart).not.toBeNull();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
  });

  test("adds multiple different items in one request", async () => {
    const productOne = await createProduct({
      name: "First Cart Product",
    });

    const productTwo = await createProduct({
      name: "Second Cart Product",
    });

    const response = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            product: productOne._id.toString(),
            variantId: productOne.variants[0]._id.toString(),
            quantity: 2,
          },
          {
            product: productTwo._id.toString(),
            variantId: productTwo.variants[1]._id.toString(),
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(2);

    expect(
      response.body.items.some(
        (item) =>
          item.product === productOne._id.toString() &&
          item.variantId === productOne.variants[0]._id.toString() &&
          item.quantity === 2,
      ),
    ).toBe(true);

    expect(
      response.body.items.some(
        (item) =>
          item.product === productTwo._id.toString() &&
          item.variantId === productTwo.variants[1]._id.toString() &&
          item.quantity === 1,
      ),
    ).toBe(true);
  });

  test("increases quantity when adding the same product variant again", async () => {
    const product = await createProduct();

    const variant = product.variants[0];

    const firstResponse = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 3,
    });

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.items).toHaveLength(1);
    expect(secondResponse.body.items[0].quantity).toBe(5);
  });

  test("keeps different variants of the same product as separate cart items", async () => {
    const product = await createProduct();

    const response = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            product: product._id.toString(),
            variantId: product.variants[0]._id.toString(),
            quantity: 2,
          },
        ],
      });

    expect(response.status).toBe(201);

    const secondResponse = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            product: product._id.toString(),
            variantId: product.variants[1]._id.toString(),
            quantity: 1,
          },
        ],
      });

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.items).toHaveLength(2);

    expect(
      secondResponse.body.items.some(
        (item) =>
          item.variantId === product.variants[0]._id.toString() &&
          item.quantity === 2,
      ),
    ).toBe(true);

    expect(
      secondResponse.body.items.some(
        (item) =>
          item.variantId === product.variants[1]._id.toString() &&
          item.quantity === 1,
      ),
    ).toBe(true);
  });

  test("returns populated product data when getting the cart", async () => {
    const product = await createProduct({
      name: "Populated Cart Product",
    });

    const variant = product.variants[0];

    const addResponse = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    expect(addResponse.status).toBe(201);

    const response = await request(app)
      .get("/cart")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body.items).toHaveLength(1);

    const item = response.body.items[0];

    expect(item.product).toEqual(
      expect.objectContaining({
        _id: product._id.toString(),
        name: "Populated Cart Product",
        price: 1000,
        category: "T-Shirts",
      }),
    );

    expect(item.product.variants).toHaveLength(2);
    expect(item.variantId).toBe(variant._id.toString());
    expect(item.quantity).toBe(2);
  });

  test("rejects adding an inactive product", async () => {
    const product = await createProduct({
      isActive: false,
    });

    const response = await addItem({
      productId: product._id,
      variantId: product.variants[0]._id,
      quantity: 1,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "PRODUCT_NOT_AVAILABLE",
    });

    const cart = await Cart.findOne({ user: user._id });

    expect(cart).toBeNull();
  });

  test("returns 404 when adding a nonexistent product", async () => {
    const product = await createProduct();

    const nonexistentProductId = new mongoose.Types.ObjectId();

    const response = await addItem({
      productId: nonexistentProductId,
      variantId: product.variants[0]._id,
      quantity: 1,
    });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "PRODUCT_NOT_FOUND",
    });
  });

  test("returns 404 when adding a nonexistent variant", async () => {
    const product = await createProduct();

    const nonexistentVariantId = new mongoose.Types.ObjectId();

    const response = await addItem({
      productId: product._id,
      variantId: nonexistentVariantId,
      quantity: 1,
    });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "VARIANT_NOT_FOUND",
    });
  });

  test("rejects adding more quantity than available stock", async () => {
    const product = await createProduct({
      firstVariantStock: 3,
    });

    const response = await addItem({
      productId: product._id,
      variantId: product.variants[0]._id,
      quantity: 4,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "INSUFFICIENT_STOCK",
    });
  });

  test("rejects adding an invalid cart payload", async () => {
    const product = await createProduct();

    const response = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            product: product._id.toString(),
            variantId: product.variants[0]._id.toString(),
            quantity: 0,
          },
        ],
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors).toEqual(expect.any(Array));

    const cart = await Cart.findOne({ user: user._id });

    expect(cart).toBeNull();
  });

  test("rejects adding an empty products array", async () => {
    const response = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [],
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors).toEqual(expect.any(Array));
  });

  test("rejects adding to the cart without authentication", async () => {
    const product = await createProduct();

    const response = await request(app)
      .post("/cart/items")
      .send({
        products: [
          {
            product: product._id.toString(),
            variantId: product.variants[0]._id.toString(),
            quantity: 1,
          },
        ],
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("updates the quantity of an existing cart item", async () => {
    const product = await createProduct();

    const variant = product.variants[0];

    const addResponse = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    expect(addResponse.status).toBe(201);

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: variant._id.toString(),
        quantity: 5,
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].quantity).toBe(5);
  });

  test("allows updating quantity to exactly the available stock", async () => {
    const product = await createProduct({
      firstVariantStock: 7,
    });

    const variant = product.variants[0];

    await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: variant._id.toString(),
        quantity: 7,
      });

    expect(response.status).toBe(200);
    expect(response.body.items[0].quantity).toBe(7);
  });

  test("rejects updating a cart item beyond available stock", async () => {
    const product = await createProduct({
      firstVariantStock: 5,
    });

    const variant = product.variants[0];

    await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: variant._id.toString(),
        quantity: 6,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "INSUFFICIENT_STOCK",
    });

    const cart = await Cart.findOne({ user: user._id });

    expect(cart.items[0].quantity).toBe(2);
  });

  test("returns 400 when updating an item without an existing cart", async () => {
    const product = await createProduct();

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: product.variants[0]._id.toString(),
        quantity: 2,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "EMPTY_CART",
    });
  });

  test("returns 404 when updating an item that is not in the cart", async () => {
    const product = await createProduct();

    await Cart.create({
      user: user._id,
      items: [],
    });

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: product.variants[0]._id.toString(),
        quantity: 2,
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ITEM_NOT_FOUND",
    });
  });

  test("rejects an invalid product ID when updating a cart item", async () => {
    const response = await request(app)
      .patch("/cart/items/not-a-valid-id")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: new mongoose.Types.ObjectId().toString(),
        quantity: 2,
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "params.productId",
          message: "Invalid ID",
        }),
      ]),
    );
  });

  test("removes an existing cart item", async () => {
    const product = await createProduct();

    const variant = product.variants[0];

    await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 2,
    });

    const response = await request(app)
      .delete(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: variant._id.toString(),
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);

    const cart = await Cart.findOne({ user: user._id });

    expect(cart.items).toHaveLength(0);
  });

  test("returns 404 when removing an item that is not in the cart", async () => {
    const product = await createProduct();

    await Cart.create({
      user: user._id,
      items: [],
    });

    const response = await request(app)
      .delete(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: product.variants[0]._id.toString(),
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ITEM_NOT_FOUND",
    });
  });

  test("returns 400 when removing an item without an existing cart", async () => {
    const product = await createProduct();

    const response = await request(app)
      .delete(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        variantId: product.variants[0]._id.toString(),
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "EMPTY_CART",
    });
  });

  test("clears all items from the cart", async () => {
    const productOne = await createProduct({
      name: "Clear Cart Product One",
    });

    const productTwo = await createProduct({
      name: "Clear Cart Product Two",
    });

    const response = await request(app)
      .post("/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        products: [
          {
            product: productOne._id.toString(),
            variantId: productOne.variants[0]._id.toString(),
            quantity: 1,
          },
          {
            product: productTwo._id.toString(),
            variantId: productTwo.variants[0]._id.toString(),
            quantity: 2,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(2);

    const clearResponse = await request(app)
      .delete("/cart")
      .set("Authorization", `Bearer ${userToken}`);

    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.items).toHaveLength(0);

    const cart = await Cart.findOne({ user: user._id });

    expect(cart).not.toBeNull();
    expect(cart.items).toHaveLength(0);
  });

  test("returns 400 when clearing a nonexistent cart", async () => {
    const response = await request(app)
      .delete("/cart")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "EMPTY_CART",
    });
  });

  test("rejects clearing the cart without authentication", async () => {
    const response = await request(app).delete("/cart");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("does not reduce product stock when an item is added to the cart", async () => {
    const product = await createProduct({
      firstVariantStock: 10,
    });

    const variant = product.variants[0];

    const response = await addItem({
      productId: product._id,
      variantId: variant._id,
      quantity: 4,
    });

    expect(response.status).toBe(201);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants.id(variant._id).stock).toBe(10);
  });

  test("does not allow one user to access another user's cart", async () => {
    const product = await createProduct();

    const addResponse = await addItem({
      token: userToken,
      productId: product._id,
      variantId: product.variants[0]._id,
      quantity: 2,
    });

    expect(addResponse.status).toBe(201);

    const response = await request(app)
      .get("/cart")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      items: [],
    });
  });

  test("does not allow one user to modify another user's cart", async () => {
    const product = await createProduct();

    const addResponse = await addItem({
      token: userToken,
      productId: product._id,
      variantId: product.variants[0]._id,
      quantity: 2,
    });

    expect(addResponse.status).toBe(201);

    const response = await request(app)
      .patch(`/cart/items/${product._id}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({
        variantId: product.variants[0]._id.toString(),
        quantity: 5,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "EMPTY_CART",
    });

    const cart = await Cart.findOne({ user: user._id });

    expect(cart.items[0].quantity).toBe(2);
  });
});