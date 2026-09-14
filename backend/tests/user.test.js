import "dotenv/config";

import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { jest } from "@jest/globals";

import connectDB from "../config/DB.js";
import app from "../app.js";
import User from "../models/User.js";

import { env } from "../config/env.js";

jest.setTimeout(30000);

describe("Customer / User API", () => {
  let user;
  let otherUser;
  let admin;

  let userToken;
  let otherUserToken;
  let adminToken;

  const password = "TestPassword123!";

  const createUser = async ({
    role = "user",
    status = "active",
    label = "user",
  } = {}) => {
    const email = `customer-${label}-${Date.now()}-${Math.random()}@example.com`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const createdUser = await User.create({
      name: `Customer ${label}`,
      email,
      phone: "9876543210",
      password: hashedPassword,
      role,
      status,
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

  const address = ({
    fullName = "Test Customer",
    phone = "9876543210",
    addressLine1 = "123 Main Street",
    addressLine2 = "",
    city = "Varanasi",
    state = "Uttar Pradesh",
    postalCode = "221001",
    country = "India",
    isDefault,
  } = {}) => {
    const data = {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    };

    if (isDefault !== undefined) {
      data.isDefault = isDefault;
    }

    return data;
  };

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});

    const createdUser = await createUser({
      label: "normal",
    });

    const createdOtherUser = await createUser({
      label: "other",
    });

    const createdAdmin = await createUser({
      role: "admin",
      label: "admin",
    });

    user = createdUser.user;
    userToken = createdUser.token;

    otherUser = createdOtherUser.user;
    otherUserToken = createdOtherUser.token;

    admin = createdAdmin.user;
    adminToken = createdAdmin.token;
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ---------------------------------------------------------
  // Profile
  // ---------------------------------------------------------

  test("updates the authenticated user's profile", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "Updated Customer",
        phone: "9123456789",
      });

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Profile updated successfully",
    );

    expect(response.body.user.name).toBe("Updated Customer");
    expect(response.body.user.phone).toBe("9123456789");

    expect(response.body.user.password).toBeUndefined();

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.name).toBe("Updated Customer");
    expect(updatedUser.phone).toBe("9123456789");
  });

  test("allows updating only the name", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "Name Only Update",
      });

    expect(response.status).toBe(200);

    expect(response.body.user.name).toBe("Name Only Update");
    expect(response.body.user.phone).toBe("9876543210");
  });

  test("allows updating only the phone number", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        phone: "9123456789",
      });

    expect(response.status).toBe(200);

    expect(response.body.user.name).toBe("Customer normal");
    expect(response.body.user.phone).toBe("9123456789");
  });

  test("rejects an empty profile update", async () => {
    const response = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "body",
          message: "At least one field is required",
        }),
      ]),
    );
  });

  test("rejects profile update without authentication", async () => {
    const response = await request(app)
      .patch("/users/me")
      .send({
        name: "Unauthorized Update",
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  // ---------------------------------------------------------
  // Addresses
  // ---------------------------------------------------------

  test("returns an empty address list for a new user", async () => {
    const response = await request(app)
      .get("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      addresses: [],
    });
  });

  test("adds an address and automatically makes the first address default", async () => {
    const response = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "First Customer",
        }),
      );

    expect(response.status).toBe(201);

    expect(response.body.message).toBe(
      "Address added successfully",
    );

    expect(response.body.address.fullName).toBe(
      "First Customer",
    );

    expect(response.body.address.isDefault).toBe(true);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses).toHaveLength(1);
    expect(updatedUser.addresses[0].isDefault).toBe(true);
  });

  test("adds a second address without changing the existing default", async () => {
    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "First Customer",
        }),
      );

    const response = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
        }),
      );

    expect(response.status).toBe(201);

    expect(response.body.address.isDefault).toBe(false);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses).toHaveLength(2);

    expect(updatedUser.addresses[0].isDefault).toBe(true);
    expect(updatedUser.addresses[1].isDefault).toBe(false);
  });

  test("adding an address with isDefault true changes the default address", async () => {
    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "First Customer",
        }),
      );

    const response = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
          isDefault: true,
        }),
      );

    expect(response.status).toBe(201);

    expect(response.body.address.isDefault).toBe(true);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses[0].isDefault).toBe(false);
    expect(updatedUser.addresses[1].isDefault).toBe(true);
  });

  test("updates an address", async () => {
    const createResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Original Name",
        }),
      );

    const addressId = createResponse.body.address._id;

    const response = await request(app)
      .patch(`/users/addresses/${addressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "Updated Name",
        city: "Lucknow",
        postalCode: "226001",
      });

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Address updated successfully",
    );

    expect(response.body.address.fullName).toBe(
      "Updated Name",
    );

    expect(response.body.address.city).toBe("Lucknow");
    expect(response.body.address.postalCode).toBe("226001");

    expect(response.body.address.addressLine1).toBe(
      "123 Main Street",
    );
  });

  test("changes the default address when another address is updated as default", async () => {
    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "First Customer",
        }),
      );

    const secondResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
        }),
      );

    const secondAddressId = secondResponse.body.address._id;

    const response = await request(app)
      .patch(`/users/addresses/${secondAddressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        isDefault: true,
      });

    expect(response.status).toBe(200);

    expect(response.body.address.isDefault).toBe(true);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses[0].isDefault).toBe(false);
    expect(updatedUser.addresses[1].isDefault).toBe(true);
  });

  test("allows unsetting the only address as default", async () => {
    const createResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(address());

    const addressId = createResponse.body.address._id;

    const response = await request(app)
      .patch(`/users/addresses/${addressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        isDefault: false,
      });

    expect(response.status).toBe(200);

    expect(response.body.address.isDefault).toBe(false);
  });

  test("rejects unsetting a default address when another address exists", async () => {
    const firstResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(address());

    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
        }),
      );

    const firstAddressId = firstResponse.body.address._id;

    const response = await request(app)
      .patch(`/users/addresses/${firstAddressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        isDefault: false,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "DEFAULT_ADDRESS_REQUIRED",
    });

    const unchangedUser = await User.findById(user._id);

    expect(unchangedUser.addresses[0].isDefault).toBe(true);
  });

  test("deletes a non-default address", async () => {
    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(address());

    const secondResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
        }),
      );

    const secondAddressId = secondResponse.body.address._id;

    const response = await request(app)
      .delete(`/users/addresses/${secondAddressId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Address deleted successfully",
    );

    expect(response.body.addresses).toHaveLength(1);

    expect(response.body.addresses[0].isDefault).toBe(true);
  });

  test("deleting the default address automatically promotes another address", async () => {
    const firstResponse = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "First Customer",
        }),
      );

    await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send(
        address({
          fullName: "Second Customer",
        }),
      );

    const firstAddressId = firstResponse.body.address._id;

    const response = await request(app)
      .delete(`/users/addresses/${firstAddressId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body.addresses).toHaveLength(1);

    expect(response.body.addresses[0].fullName).toBe(
      "Second Customer",
    );

    expect(response.body.addresses[0].isDefault).toBe(true);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses).toHaveLength(1);
    expect(updatedUser.addresses[0].isDefault).toBe(true);
  });

  test("rejects adding an invalid address", async () => {
    const response = await request(app)
      .post("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fullName: "",
        phone: "123",
        addressLine1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      });

    expect(response.status).toBe(400);

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.addresses).toHaveLength(0);
  });

  test("rejects an invalid address ID", async () => {
    const response = await request(app)
      .patch("/users/addresses/not-a-valid-id")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        city: "Lucknow",
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe("Validation failed");

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "params.id",
          message: "Invalid ID",
        }),
      ]),
    );
  });

  test("returns 404 when updating a nonexistent address", async () => {
    const addressId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(`/users/addresses/${addressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        city: "Lucknow",
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ADDRESS_NOT_FOUND",
    });
  });

  test("returns 404 when deleting a nonexistent address", async () => {
    const addressId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/users/addresses/${addressId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ADDRESS_NOT_FOUND",
    });
  });

  test("does not allow one user to access another user's addresses", async () => {
    await User.findByIdAndUpdate(otherUser._id, {
      $push: {
        addresses: address({
          fullName: "Other User Address",
          isDefault: true,
        }),
      },
    });

    const response = await request(app)
      .get("/users/addresses")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body.addresses).toHaveLength(0);
  });

  test("does not allow one user to modify another user's address", async () => {
    const otherUserAddress = await User.findByIdAndUpdate(
      otherUser._id,
      {
        $push: {
          addresses: address({
            fullName: "Other User Address",
            isDefault: true,
          }),
        },
      },
      {
        returnDocument: "after",
      },
    );

    const addressId = otherUserAddress.addresses[0]._id;

    const response = await request(app)
      .patch(`/users/addresses/${addressId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        city: "Unauthorized City",
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "ADDRESS_NOT_FOUND",
    });

    const unchangedUser = await User.findById(otherUser._id);

    expect(unchangedUser.addresses[0].city).toBe("Varanasi");
  });

  // ---------------------------------------------------------
  // Admin customer management
  // ---------------------------------------------------------

  test("admin can retrieve all customers", async () => {
    const response = await request(app)
      .get("/users/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    expect(response.body.user).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: user._id.toString(),
          email: user.email,
        }),
        expect.objectContaining({
          _id: otherUser._id.toString(),
          email: otherUser.email,
        }),
        expect.objectContaining({
          _id: admin._id.toString(),
          email: admin.email,
        }),
      ]),
    );

    expect(response.body.user.length).toBe(3);

    for (const customer of response.body.user) {
      expect(customer.password).toBeUndefined();
    }
  });

  test("normal user cannot retrieve the admin customer list", async () => {
    const response = await request(app)
      .get("/users/admin")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Forbidden",
    });
  });

  test("admin can retrieve a customer by ID", async () => {
    const response = await request(app)
      .get(`/users/admin/${user._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    expect(response.body.user._id).toBe(
      user._id.toString(),
    );

    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.name).toBe("Customer normal");
    expect(response.body.user.password).toBeUndefined();
  });

  test("normal user cannot retrieve a customer by ID", async () => {
    const response = await request(app)
      .get(`/users/admin/${user._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Forbidden",
    });
  });

  test("rejects an invalid admin customer ID", async () => {
    const response = await request(app)
      .get("/users/admin/not-a-valid-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "invalid ID",
    });
  });

  test("returns 404 when admin requests a nonexistent customer", async () => {
    const nonexistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .get(`/users/admin/${nonexistentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "USER_NOT_FOUND",
    });
  });

  test("admin can block a customer", async () => {
    const response = await request(app)
      .patch(`/users/admin/${user._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "blocked",
      });

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "User status updated successfully",
    );

    expect(response.body.user.status).toBe("blocked");

    const blockedUser = await User.findById(user._id);

    expect(blockedUser.status).toBe("blocked");
  });

  test("blocked customer can no longer authenticate", async () => {
    await User.findByIdAndUpdate(user._id, {
      status: "blocked",
    });

    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Account is blocked",
    });
  });

  test("admin can reactivate a blocked customer", async () => {
    await User.findByIdAndUpdate(user._id, {
      status: "blocked",
    });

    const response = await request(app)
      .patch(`/users/admin/${user._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "active",
      });

    expect(response.status).toBe(200);

    expect(response.body.user.status).toBe("active");

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.status).toBe("active");
  });

  test("does not allow an admin account to be blocked", async () => {
    const response = await request(app)
      .patch(`/users/admin/${admin._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "blocked",
      });

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Admin accounts cannot be blocked",
    });

    const unchangedAdmin = await User.findById(admin._id);

    expect(unchangedAdmin.status).toBe("active");
  });

  test("normal user cannot change customer status", async () => {
    const response = await request(app)
      .patch(`/users/admin/${otherUser._id}/status`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        status: "blocked",
      });

    expect(response.status).toBe(403);

    const unchangedUser = await User.findById(otherUser._id);

    expect(unchangedUser.status).toBe("active");
  });

  test("rejects an invalid customer status", async () => {
    const response = await request(app)
      .patch(`/users/admin/${user._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "something-invalid",
      });

    expect(response.status).toBe(400);

    const unchangedUser = await User.findById(user._id);

    expect(unchangedUser.status).toBe("active");
  });

  test("returns 404 when updating status for a nonexistent customer", async () => {
    const nonexistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .patch(`/users/admin/${nonexistentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "blocked",
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "USER_NOT_FOUND",
    });
  });
});