import { register, login } from "../services/userServices.js";

//* POST(/register)
const userRegister = async (req, res) => {
  const { name, email, password } = req.body;

  const user = await register(name, email, password);

  if (user === null) {
    return res.status(409).json({ message: "User already exists" });
  }

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

//* POST(/login)
const userLogin = async (req, res) => {
  const { email, password } = req.body;

  const token = await login(email, password);

  if (token === null) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.status(200).json({ message: "Login successful", token: token });
};

export { userRegister, userLogin };
