import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

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
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default authenticateUser;
