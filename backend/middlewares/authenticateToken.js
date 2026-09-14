import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

import User from "../models/User.js";

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authHeader.slice(7);

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }

  const user = await User.findById(decoded.userId).select(
    "_id name email role status",
  );

  if (!user) {
    return res.status(401).json({
      message: "User not found",
    });
  }

  if (user.status !== "active") {
    return res.status(403).json({
      message: "Account is blocked",
    });
  }

  req.user = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  next();
};

export default authenticateUser;
