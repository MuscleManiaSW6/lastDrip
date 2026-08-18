import mongoose from "mongoose";

const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  const isValid = mongoose.isValidObjectId(id);

  if (!isValid) {
    return res.status(400).json({ message: "invalid ID" });
  }

  next();
};

export default validateObjectId;
