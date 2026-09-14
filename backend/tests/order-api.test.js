import "dotenv/config";

import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../services/paymentServices.js", () => ({
  createRazorpayOrder: jest.fn(async (amount, orderId) => ({
    id: `order_test_${orderId}`,
    amount: amount * 100,
    currency: "INR",
  })),

  verifyRazorpayPayment: jest.fn(),

  refundPayment: jest.fn(),

  handlePaymentCaptured: jest.fn(),

  handlePaymentFailed: jest.fn(),

  handleRefundWebhook: jest.fn(),
}));

const { default: connectDB } = await import("../config/DB.js");

const { default: app } = await import("../app.js");

const { default: User } = await import("../models/User.js");
const { default: Product } = await import("../models/Product.js");
const { default: Cart } = await import("../models/Cart.js");
const { default: Order } = await import("../models/Orders.js");

const { env } = await import("../config/env.js");

jest.setTimeout(30000);

describe("Order API", () => {
  let user;
  let otherUser;
  let adminUser;

  let userToken;
  let otherUserToken;
  let adminToken;

  const password = "TestPassword123!";

  const createUser = async (role, label) => {
    const email = `order-api-${label}-${Date.now()}-${Math.random()}@example.com`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const createdUser = await User.create({
      name: `Order API ${label} User`,
      email,
      phone: "9876543210",
      password: hashedPassword,
      role,
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

  const createAddress = (overrides = {}) => ({
    fullName: user.name,
    phone: user.phone,
    addressLine1: "123 Order Street",
    addressLine2: "Apartment 4B",
    city: "Varanasi",
    state: "Uttar Pradesh",
    postalCode: "221001",
    country: "India",
    isDefault: true,
    ...overrides,
  });

  const addAddressToUser = async (owner = user, overrides = {}) => {
    const address = {
      fullName: owner.name,
      phone: owner.phone,
      addressLine1: "123 Order Street",
      addressLine2: "Apartment 4B",
      city: "Varanasi",
      state: "Uttar Pradesh",
      postalCode: "221001",
      country: "India",
      isDefault: true,
      ...overrides,
    };

    owner.addresses.push(address);

    await owner.save();

    return owner.addresses[owner.addresses.length - 1];
  };

  const createProduct = async ({
    name = "Order Test T-Shirt",
    price = 1000,
    firstVariantStock = 10,
    secondVariantStock = 5,
    isActive = true,
  } = {}) => {
    return await Product.create({
      name,
      price,
      description: `${name} description`,
      category: "T-Shirts",
      isActive,
      images: [
        {
          url: "https://example.com/order-test-shirt.jpg",
          alt: `${name} image`,
        },
      ],
      variants: [
        {
          sku: `ORDER-${Date.now()}-${Math.random()}`,
          size: "M",
          color: "Black",
          stock: firstVariantStock,
          price: 1000,
        },
        {
          sku: `ORDER-${Date.now()}-${Math.random()}-L`,
          size: "L",
          color: "Black",
          stock: secondVariantStock,
          price: 1200,
        },
      ],
    });
  };

  const addCartItem = async ({
    owner = user,
    product,
    variant = product.variants[0],
    quantity = 1,
  }) => {
    return await Cart.create({
      user: owner._id,
      items: [
        {
          product: product._id,
          variantId: variant._id,
          quantity,
        },
      ],
    });
  };

  const createManualOrder = async ({
    owner = user,
    status = "pending",
    paymentStatus = "captured",
    inventoryStatus = "allocated",
    product = null,
    variantId = null,
    quantity = 1,
  } = {}) => {
    let orderProductData;

    if (product) {
      const variant = product.variants.id(variantId);

      orderProductData = {
        product: product._id,
        variantId: variant._id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        name: product.name,
        price: variant.price ?? product.price,
        quantity,
      };
    } else {
      orderProductData = {
        product: new mongoose.Types.ObjectId(),
        variantId: new mongoose.Types.ObjectId(),
        sku: "MANUAL-ORDER-M",
        size: "M",
        color: "Black",
        name: "Manual Order Product",
        price: 1000,
        quantity,
      };
    }

    return await Order.create({
      user: owner._id,

      idempotencyKey: `order-api-${Date.now()}-${Math.random()}`,

      orderNumber: `LD-API-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,

      products: [orderProductData],

      shippingAddress: {
        fullName: owner.name,
        phone: owner.phone,
        addressLine1: "123 Order Street",
        addressLine2: "Apartment 4B",
        city: "Varanasi",
        state: "Uttar Pradesh",
        postalCode: "221001",
        country: "India",
      },

      totalPrice: orderProductData.price * quantity,

      status,

      payment: {
        status: paymentStatus,
        razorpayOrderId: `order_manual_${Date.now()}_${Math.random()}`,
      },

      inventory: {
        status: inventoryStatus,
      },
    });
  };

  beforeAll(async () => {
    await connectDB();

    const createdUser = await createUser("user", "primary");
    const createdOtherUser = await createUser("user", "secondary");
    const createdAdmin = await createUser("admin", "admin");

    user = createdUser.user;
    userToken = createdUser.token;

    otherUser = createdOtherUser.user;
    otherUserToken = createdOtherUser.token;

    adminUser = createdAdmin.user;
    adminToken = createdAdmin.token;
  });

  beforeEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    await User.findByIdAndUpdate(user._id, {
      $set: {
        addresses: [],
      },
    });

    user = await User.findById(user._id);
  });

  afterAll(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    await User.deleteMany({
      _id: {
        $in: [user._id, otherUser._id, adminUser._id],
      },
    });

    await mongoose.connection.close();
  });

  test("rejects creating an order without authentication", async () => {
    const response = await request(app)
      .post("/orders")
      .set("Idempotency-Key", `no-auth-${Date.now()}`)
      .send({
        addressId: new mongoose.Types.ObjectId().toString(),
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("rejects creating an order without an idempotency key", async () => {
    const address = await addAddressToUser();

    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 1,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "IDEMPOTENCY_KEY_REQUIRED",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test("rejects creating an order without an address ID", async () => {
    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 1,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `missing-address-${Date.now()}`)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "Validation failed",
      errors: expect.any(Array),
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test("rejects an invalid address ID", async () => {
    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 1,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `invalid-address-${Date.now()}`)
      .send({
        addressId: "not-a-valid-id",
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "body.addressId",
          message: "Invalid ID",
        }),
      ]),
    );
  });

  test("rejects creating an order with an empty cart", async () => {
    const address = await addAddressToUser();

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `empty-cart-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "EMPTY_CART",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test("rejects creating an order with a nonexistent address", async () => {
    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 1,
    });

    const nonexistentAddressId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `nonexistent-address-${Date.now()}`)
      .send({
        addressId: nonexistentAddressId.toString(),
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ADDRESS_NOT_FOUND",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(10);
  });

  test("creates an order from the user's cart", async () => {
    const address = await addAddressToUser();

    const product = await createProduct({
      price: 1000,
      firstVariantStock: 10,
    });

    const variant = product.variants[0];

    await addCartItem({
      product,
      variant,
      quantity: 2,
    });

    const idempotencyKey = `create-order-${Date.now()}`;

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(201);

    expect(response.body._id).toBeDefined();
    expect(response.body.orderNumber).toMatch(/^LD-\d{8}-\d{6}$/);

    expect(response.body.products).toHaveLength(1);

    expect(response.body.products[0].product).toBe(product._id.toString());

    expect(response.body.products[0].variantId).toBe(variant._id.toString());

    expect(response.body.products[0].sku).toBe(variant.sku);
    expect(response.body.products[0].size).toBe(variant.size);
    expect(response.body.products[0].color).toBe(variant.color);
    expect(response.body.products[0].name).toBe(product.name);
    expect(response.body.products[0].price).toBe(variant.price);
    expect(response.body.products[0].quantity).toBe(2);

    expect(response.body.totalPrice).toBe(variant.price * 2);

    expect(response.body.shippingAddress.fullName).toBe(address.fullName);

    expect(response.body.shippingAddress.addressLine1).toBe(
      address.addressLine1,
    );

    expect(response.body.shippingAddress.city).toBe(address.city);
    expect(response.body.shippingAddress.state).toBe(address.state);
    expect(response.body.shippingAddress.postalCode).toBe(address.postalCode);
    expect(response.body.shippingAddress.country).toBe(address.country);

    expect(response.body.status).toBe("pending");
    expect(response.body.payment.status).toBe("pending");
    expect(response.body.payment.razorpayOrderId).toBeDefined();
    expect(response.body.inventory.status).toBe("reserved");

    const storedOrder = await Order.findById(response.body._id);

    expect(storedOrder).not.toBeNull();
    expect(storedOrder.idempotencyKey).toBe(idempotencyKey);

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants.id(variant._id).stock).toBe(8);

    const cart = await Cart.findOne({
      user: user._id,
    });

    expect(cart.items).toHaveLength(0);
  });

  test("uses the variant price when creating an order", async () => {
    const address = await addAddressToUser();

    const product = await createProduct({
      firstVariantStock: 10,
    });

    const variant = product.variants[1];

    await addCartItem({
      product,
      variant,
      quantity: 2,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `variant-price-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(201);

    expect(response.body.products[0].price).toBe(1200);
    expect(response.body.totalPrice).toBe(2400);
  });

  test("creates an order with multiple cart items and calculates the total correctly", async () => {
    const address = await addAddressToUser();

    const productOne = await createProduct({
      name: "First Order Product",
      firstVariantStock: 10,
    });

    const productTwo = await createProduct({
      name: "Second Order Product",
      firstVariantStock: 10,
    });

    await Cart.create({
      user: user._id,
      items: [
        {
          product: productOne._id,
          variantId: productOne.variants[0]._id,
          quantity: 2,
        },
        {
          product: productTwo._id,
          variantId: productTwo.variants[1]._id,
          quantity: 1,
        },
      ],
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `multiple-items-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(201);

    expect(response.body.products).toHaveLength(2);

    const expectedTotal =
      productOne.variants[0].price * 2 + productTwo.variants[1].price * 1;

    expect(response.body.totalPrice).toBe(expectedTotal);

    const updatedProductOne = await Product.findById(productOne._id);

    const updatedProductTwo = await Product.findById(productTwo._id);

    expect(
      updatedProductOne.variants.id(productOne.variants[0]._id).stock,
    ).toBe(8);

    expect(
      updatedProductTwo.variants.id(productTwo.variants[1]._id).stock,
    ).toBe(4);
  });

  test("clears the cart after successfully creating an order", async () => {
    const address = await addAddressToUser();

    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 2,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `clear-cart-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(201);

    const cart = await Cart.findOne({
      user: user._id,
    });

    expect(cart).not.toBeNull();
    expect(cart.items).toHaveLength(0);
  });

  test("creates the same order when the same idempotency key is reused", async () => {
    const address = await addAddressToUser();

    const product = await createProduct({
      firstVariantStock: 10,
    });

    await addCartItem({
      product,
      quantity: 2,
    });

    const idempotencyKey = `duplicate-order-${Date.now()}`;

    const firstResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        addressId: address._id.toString(),
      });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        addressId: address._id.toString(),
      });

    expect(secondResponse.status).toBe(201);

    expect(secondResponse.body._id).toBe(firstResponse.body._id);

    expect(secondResponse.body.orderNumber).toBe(
      firstResponse.body.orderNumber,
    );

    expect(await Order.countDocuments({ user: user._id })).toBe(1);

    const productAfterRetry = await Product.findById(product._id);

    expect(productAfterRetry.variants[0].stock).toBe(8);
  });

  test("does not allow an idempotency key to be reused by another user", async () => {
    const address = await addAddressToUser();

    const product = await createProduct();

    await addCartItem({
      product,
      quantity: 1,
    });

    const idempotencyKey = `cross-user-${Date.now()}`;

    const firstResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        addressId: address._id.toString(),
      });

    expect(firstResponse.status).toBe(201);

    const otherAddress = await addAddressToUser(otherUser);

    const otherProduct = await createProduct({
      name: "Other User Product",
    });

    await addCartItem({
      owner: otherUser,
      product: otherProduct,
      quantity: 1,
    });

    const secondResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        addressId: otherAddress._id.toString(),
      });

    expect(secondResponse.status).toBe(201);

    expect(secondResponse.body._id).not.toBe(firstResponse.body._id);

    expect(
      await Order.countDocuments({
        user: user._id,
      }),
    ).toBe(1);

    expect(
      await Order.countDocuments({
        user: otherUser._id,
      }),
    ).toBe(1);
  });

  test("rejects creating an order when stock is insufficient", async () => {
    const address = await addAddressToUser();

    const product = await createProduct({
      firstVariantStock: 2,
    });

    await addCartItem({
      product,
      quantity: 3,
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `insufficient-stock-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "INSUFFICIENT_STOCK",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);

    const unchangedProduct = await Product.findById(product._id);

    expect(unchangedProduct.variants[0].stock).toBe(2);

    const cart = await Cart.findOne({
      user: user._id,
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  test("rejects an invalid product reference in the cart", async () => {
    const address = await addAddressToUser();

    const product = await createProduct();

    await Cart.create({
      user: user._id,
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          variantId: product.variants[0]._id,
          quantity: 1,
        },
      ],
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `missing-product-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "PRODUCT_NOT_FOUND",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test("rejects an invalid variant reference in the cart", async () => {
    const address = await addAddressToUser();

    const product = await createProduct();

    await Cart.create({
      user: user._id,
      items: [
        {
          product: product._id,
          variantId: new mongoose.Types.ObjectId(),
          quantity: 1,
        },
      ],
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `missing-variant-${Date.now()}`)
      .send({
        addressId: address._id.toString(),
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "VARIANT_NOT_FOUND",
    });

    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test("returns the authenticated user's orders", async () => {
    const firstOrder = await createManualOrder({
      owner: user,
    });

    const secondOrder = await createManualOrder({
      owner: user,
    });

    await createManualOrder({
      owner: otherUser,
    });

    const response = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toHaveLength(2);

    const returnedIds = response.body.map((order) => order._id.toString());

    expect(returnedIds).toContain(firstOrder._id.toString());
    expect(returnedIds).toContain(secondOrder._id.toString());

    response.body.forEach((order) => {
      expect(order.user).toBeUndefined();
    });
  });

  test("returns an empty array when the authenticated user has no orders", async () => {
    const response = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual([]);
  });

  test("rejects retrieving orders without authentication", async () => {
    const response = await request(app).get("/orders");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("returns a user's order by ID", async () => {
    const order = await createManualOrder({
      owner: user,
    });

    const response = await request(app)
      .get(`/orders/${order._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body._id).toBe(order._id.toString());
    expect(response.body.orderNumber).toBe(order.orderNumber);
    expect(response.body.user).toBeUndefined();
  });

  test("does not allow a user to retrieve another user's order", async () => {
    const order = await createManualOrder({
      owner: otherUser,
    });

    const response = await request(app)
      .get(`/orders/${order._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Order not found",
    });
  });

  test("returns 404 for a nonexistent order", async () => {
    const nonexistentOrderId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .get(`/orders/${nonexistentOrderId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Order not found",
    });
  });

  test("rejects an invalid order ID", async () => {
    const response = await request(app)
      .get("/orders/not-a-valid-id")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("rejects cancelling an order without authentication", async () => {
    const order = await createManualOrder({
      owner: user,
    });

    const response = await request(app).patch(`/orders/${order._id}/cancel`);

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("cancels the authenticated user's pending order", async () => {
    const product = await createProduct({
      firstVariantStock: 5,
    });

    const order = await createManualOrder({
      owner: user,
      status: "pending",
      paymentStatus: "pending",
      inventoryStatus: "reserved",
      product,
      variantId: product.variants[0]._id,
      quantity: 2,
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("cancelled");
    expect(response.body.inventory.status).toBe("released");

    const storedOrder = await Order.findById(order._id);

    expect(storedOrder.status).toBe("cancelled");
    expect(storedOrder.inventory.status).toBe("released");

    const updatedProduct = await Product.findById(product._id);

    expect(updatedProduct.variants.id(product.variants[0]._id).stock).toBe(7);
  });

  test("does not allow a user to cancel another user's order", async () => {
    const order = await createManualOrder({
      owner: otherUser,
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ORDER_NOT_FOUND",
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
  });

  test("rejects cancelling an order that cannot be cancelled", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "delivered",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "ORDER_CANNOT_BE_CANCELLED",
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("delivered");
  });

  test("admin can retrieve all orders", async () => {
    const userOrder = await createManualOrder({
      owner: user,
    });

    const otherOrder = await createManualOrder({
      owner: otherUser,
    });

    const response = await request(app)
      .get("/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toHaveLength(2);

    const returnedIds = response.body.map((order) => order._id.toString());

    expect(returnedIds).toContain(userOrder._id.toString());
    expect(returnedIds).toContain(otherOrder._id.toString());

    response.body.forEach((order) => {
      expect(order.user).toBeDefined();
      expect(order.user.name).toBeDefined();
      expect(order.user.email).toBeDefined();
      expect(order.user.password).toBeUndefined();
    });
  });

  test("normal user cannot retrieve the admin order list", async () => {
    const response = await request(app)
      .get("/orders/admin")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Forbidden",
    });
  });

  test("rejects retrieving the admin order list without authentication", async () => {
    const response = await request(app).get("/orders/admin");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("returns 404 when the admin order list is empty", async () => {
    const response = await request(app)
      .get("/orders/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "No orders found",
    });
  });

  test("admin can update an order to processing", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "pending",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "processing",
      });

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("processing");
  });

  test("admin can update an order to shipped with carrier and tracking number", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "processing",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "shipped",
        carrier: "Delhivery",
        trackingNumber: "DLV123456789",
      });

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("shipped");
    expect(response.body.shipping.carrier).toBe("Delhivery");
    expect(response.body.shipping.trackingNumber).toBe("DLV123456789");
    expect(response.body.shipping.shippedAt).toBeDefined();
  });

  test("admin can update a shipped order to delivered", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "shipped",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "delivered",
      });

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("delivered");
    expect(response.body.shipping.deliveredAt).toBeDefined();
  });

  test("normal user cannot update order status", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "pending",
      paymentStatus: "captured",
      inventoryStatus: "allocated",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        status: "processing",
      });

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Forbidden",
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
  });

  test("rejects an invalid order status", async () => {
    const order = await createManualOrder({
      owner: user,
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "invalid-status",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: expect.any(String),
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
  });

  test("rejects an invalid order ID when updating status", async () => {
    const response = await request(app)
      .patch("/orders/not-a-valid-id/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "processing",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("returns ORDER_NOT_FOUND when admin updates a nonexistent order", async () => {
    const nonexistentOrderId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(`/orders/${nonexistentOrderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "processing",
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ORDER_NOT_FOUND",
    });
  });

  test("rejects moving an unpaid order to processing", async () => {
    const order = await createManualOrder({
      owner: user,
      status: "pending",
      paymentStatus: "pending",
      inventoryStatus: "reserved",
    });

    const response = await request(app)
      .patch(`/orders/${order._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "processing",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "PAYMENT_NOT_CAPTURED",
    });

    const unchangedOrder = await Order.findById(order._id);

    expect(unchangedOrder.status).toBe("pending");
  });
});
