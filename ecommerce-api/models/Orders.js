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

  payment: {
    status: {
      type: String,
      enum: ["pending", "authorized", "captured", "failed", "refunded"],
      default: "pending",
    },

    razorpayOrderId: {
      type: String,
    },

    razorpayPaymentId: {
      type: String,
    },
  },
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
