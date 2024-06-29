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
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
      },
    },
    toObject: { virtuals: true },
  }
);

// Compound unique index
orderSchema.index({ userId: 1, tableId: 1 }, { unique: true });

// Virtual
orderSchema.virtual("items.menuItem", {
  ref: "menuItems",
  localField: "items.menuItemId",
  foreignField: "_id",
});

const Order = mongoose.model("orders", orderSchema);
module.exports = Order;
