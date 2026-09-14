import "dotenv/config";

import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { jest } from "@jest/globals";

import connectDB from "../config/DB.js";
import app from "../app.js";
import User from "../models/User.js";

import { env } from "../config/env.js";

jest.setTimeout(15000);

describe("Authentication", () => {
  let user;
  let token;
  let email;

  const password = "TestPassword123!";

  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    email = `auth-test-${Date.now()}-${Math.random()}@example.com`;

    const registerResponse = await request(app)
      .post("/users/register")
      .send({
        name: "Auth Test User",
        email,
        password,
        phone: "9876543210",
      });

    expect(registerResponse.status).toBe(201);

    user = await User.findOne({ email });

    const loginResponse = await request(app)
      .post("/users/login")
      .send({
        email,
        password,
      });

    expect(loginResponse.status).toBe(200);

    token = loginResponse.body.token;
  });

  afterEach(async () => {
    if (user) {
      await User.findByIdAndDelete(user._id);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("registers a new user", async () => {
    const newEmail = `new-user-${Date.now()}@example.com`;

    const response = await request(app)
      .post("/users/register")
      .send({
        name: "New Test User",
        email: newEmail,
        password,
        phone: "9876543210",
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      message: "User registered successfully",
      user: {
        id: expect.any(String),
        name: "New Test User",
        email: newEmail,
      },
    });

    await User.findOneAndDelete({ email: newEmail });
  });

  test("rejects duplicate email registration", async () => {
    const response = await request(app)
      .post("/users/register")
      .send({
        name: "Another User",
        email,
        password,
        phone: "9876543210",
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      message: "User already exists",
    });
  });

  test("logs in with valid credentials", async () => {
    const response = await request(app)
      .post("/users/login")
      .send({
        email,
        password,
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(response.body.token).toEqual(expect.any(String));
  });

  test("rejects incorrect password", async () => {
    const response = await request(app)
      .post("/users/login")
      .send({
        email,
        password: "WrongPassword123!",
      });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Invalid credentials",
    });
  });

  test("rejects requests without authentication", async () => {
    const response = await request(app).get("/users/me");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("rejects malformed authorization header", async () => {
    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Basic ${token}`);

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  test("rejects an invalid JWT", async () => {
    const response = await request(app)
      .get("/users/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "Invalid or expired token",
    });
  });

  test("allows an authenticated user to access /me", async () => {
    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.user._id).toBe(user._id.toString());
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.name).toBe("Auth Test User");
    expect(response.body.user.password).toBeUndefined();
  });

  test("rejects a blocked account", async () => {
    await User.findByIdAndUpdate(user._id, {
      status: "blocked",
    });

    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      message: "Account is blocked",
    });
  });

  test("rejects a valid JWT for a deleted user", async () => {
    const deletedUserId = user._id.toString();

    const deletedUserToken = jwt.sign(
      {
        userId: deletedUserId,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    await User.findByIdAndDelete(user._id);

    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${deletedUserToken}`);

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      message: "User not found",
    });

    user = null;
  });
});