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

  images: [
    {
      url: {
        type: String,
        required: true,
        trim: true,
      },

      alt: {
        type: String,
        trim: true,
      },
    },
  ],

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

  variants: [
    {
      sku: {
        type: String,
        required: true,
        trim: true,
      },

      size: {
        type: String,
        required: true,
        trim: true,
      },

      color: {
        type: String,
        required: true,
        trim: true,
      },

      stock: {
        type: Number,
        required: true,
        min: 0,
      },

      price: {
        type: Number,
        min: 1,
      },
    },
  ],

  isActive: {
    type: Boolean,
    default: true,
  },
});

const Product = mongoose.model("Product", productSchema);

export default Product;
