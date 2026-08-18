import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//* POST(/register)
const register = async (name, email, password) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return null;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  return user;
};

//* POST(/login)
const login = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
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
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );

  return token;
};

export { register, login };
