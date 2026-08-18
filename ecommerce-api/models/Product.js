import mongoose from "mongoose";

const productSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  price: {
    type: Number,
    required: true,
    min: 1,
  },

  description: {
    type: String,
    required: true,
    trim: true,
  },

  category: {
    type: String,
    required: true,
    trim: true,
  },

  stock: {
    type: Number,
    required: true,
    min: 0,
  },
});

const Product = mongoose.model("Product", productSchema);

export default Product;
