import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },

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

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      addressLine1: {
        type: String,
        required: true,
        trim: true,
      },
      addressLine2: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
      },
    },

    shipping: {
      carrier: {
        type: String,
        trim: true,
      },

      trackingNumber: {
        type: String,
        trim: true,
      },

      shippedAt: {
        type: Date,
      },

      deliveredAt: {
        type: Date,
      },
    },

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
        unique: true,
        sparse: true,
      },

      razorpayPaymentId: {
        type: String,
      },

      refund: {
        status: {
          type: String,
          enum: ["processing", "processed", "failed"],
        },

        razorpayRefundId: {
          type: String,
        },

        amount: {
          type: Number,
          min: 1,
        },
      },
    },

    email: {
      orderConfirmationQueued: {
        type: Boolean,
        default: false,
      },
    },

    inventory: {
      status: {
        type: String,
        enum: ["reserved", "allocated", "released"],
        default: "reserved",
      },
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

const Order = mongoose.model("Order", orderSchema);

export default Order;
