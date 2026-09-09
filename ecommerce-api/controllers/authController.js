import {
  register,
  login,
  getCurrentUser,
  updateProfile,
  updateAddress,
  getAddresses,
  addAddress,
  deleteAddress,
} from "../services/userServices.js";

//* POST("/register")
const userRegister = async (req, res) => {
  const { name, email, password, phone } = req.body;

  const user = await register(name, email, password, phone);

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

//* POST("/login")
const userLogin = async (req, res) => {
  const { email, password } = req.body;

  const token = await login(email, password);

  if (token === null) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.status(200).json({ message: "Login successful", token: token });
};

//* GET ("/me")
const currentUser = async (req, res) => {
  const user = await getCurrentUser(req.user.userId);

  res.status(200).json({ user });
};

//* PATCH ("/me")
const updateUserProfile = async (req, res) => {
  const { name, phone } = req.body;

  const user = await updateProfile(req.user.userId, name, phone);

  res.status(200).json({ message: "Profile updated successfully", user });
};

//* GET ("/addresses")
const userAddress = async (req, res) => {
  const addresses = await getAddresses(req.user.userId);

  res.status(200).json({ addresses });
};

//* POST ("/addresses")
const addUserAddress = async (req, res) => {
  const address = await addAddress(req.user.userId, req.body);

  res.status(201).json({ message: "Address added successfully", address });
};

//* PATCH ("/addresses/:id")
const updateUserAddress = async (req, res) => {
  const address = await updateAddress(req.user.userId, req.params.id, req.body);

  res.status(200).json({
    message: "Address updated successfully",
    address,
  });
};

//* DELETE ("/addresses/:id")
const deleteUserAddress = async (req, res) => {
  const addresses = await deleteAddress(req.user.userId, req.params.id);

  res.status(200).json({
    message: "Address deleted successfully",
    addresses,
  });
};

export {
  userRegister,
  userLogin,
  currentUser,
  updateUserProfile,
  userAddress,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
};
