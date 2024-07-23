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
          default: Date.now,
        },
      },
    ],

    amount: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        ret.items.forEach((element) => {
          delete element.id;
          delete element.menuItemId.id;
        });
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual
orderSchema.virtual("items.menuItem", {
  ref: "menuItems",
  localField: "items.menuItemId",
  foreignField: "_id",
});

orderSchema.virtual("userId.user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
});

orderSchema.virtual("tableId.table", {
  ref: "tables",
  localField: "tableId",
  foreignField: "_id",
});

const Order = mongoose.model("orders", orderSchema);
module.exports = Order;
