const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "user id is required!"],
    },

    tableId: {
      type: mongoose.Schema.ObjectId,
      ref: "tables",
      required: [true, "table id is required!"],
    },

    status: {
      type: String,
      default: "unpaid",
    },

    items: [
      {
        menuItemId: {
          type: mongoose.Schema.ObjectId,
          ref: "menuItems",
        },

        quantity: {
          type: Number,
        },
        note: {
          type: String,
          default: "",
        },

        options: {
          type: String,
          default: "",
        },

        status: {
          type: String,
          enum: ["loading", "finished"],
          default: "loading",
        },

        createdAt: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound unique index
orderSchema.index({ userId: 1, tableId: 1 }, { unique: true });

const Order = mongoose.model("orders", orderSchema);
module.exports = Order;
