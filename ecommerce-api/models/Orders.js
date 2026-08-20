import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      name: {
        type: String,
        trim: true,
        required: true,
      },

      price: {
        type: Number,
        min: 1,
        required: true,
      },

      quantity: {
        type: Number,
        min: 1,
        required: true,
      },
    },
  ],

  totalPrice: {
    type: Number,
    min: 1,
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
