import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

//* POST(/register)
const register = async (name, email, password, phone) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return null;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
    });

    return user;
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return null;
    }

    throw err;
  }
};

//* POST(/login)
const login = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    return null;
  }

  if (user.status === "blocked") {
    return null;
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return null;
  }

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

  return token;
};

//* GET (/me)
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  return user;
};

//* PATCH (/me)
const updateProfile = async (userId, name, phone) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { name, phone },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("-password");

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  return user;
};

//* GET (/addresses)
const getAddresses = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  return user.addresses;
};

//* POST (/addresses)
const addAddress = async (userId, addressData) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (addressData.isDefault) {
    for (let i = 0; i < user.addresses.length; i++) {
      user.addresses[i].isDefault = false;
    }
  }

  if (user.addresses.length === 0) {
    addressData.isDefault = true;
  }

  user.addresses.push(addressData);

  await user.save();

  return user.addresses[user.addresses.length - 1];
};

//* PATCH (/addresses/:id)
const updateAddress = async (userId, addressId, addressData) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    const err = new Error("ADDRESS_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (addressData.isDefault === true) {
    for (let i = 0; i < user.addresses.length; i++) {
      user.addresses[i].isDefault = false;
    }
  }

  if (
    address.isDefault &&
    addressData.isDefault === false &&
    user.addresses.length > 1
  ) {
    const err = new Error("DEFAULT_ADDRESS_REQUIRED");
    err.statusCode = 400;
    throw err;
  }

  Object.assign(address, addressData);

  await user.save();

  return address;
};

//* DELETE (/addresses/:id)
const deleteAddress = async (userId, addressId) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    const err = new Error("ADDRESS_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  const wasDefault = address.isDefault;

  address.deleteOne();

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  return user.addresses;
};

//* GET (/admin)
const getAllUsers = async () => {
  return await User.find().select("-password").sort({ createdAt: -1 });
};

//* GET (/admin/:id)
const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  return user;
};

//* PATCH (/admin/:id/status)
const updateUserStatus = async (userId, status) => {
  const existingUser = await User.findById(userId);

  if (!existingUser) {
    const err = new Error("USER_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }

  if (existingUser.role === "admin" && status === "blocked") {
    const err = new Error("Admin accounts cannot be blocked");
    err.statusCode = 403;
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { status: status },
    { returnDocument: "after", runValidators: true },
  ).select("-password");

  return user;
};

export {
  register,
  login,
  getCurrentUser,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getAllUsers,
  getUserById,
  updateUserStatus,
};
