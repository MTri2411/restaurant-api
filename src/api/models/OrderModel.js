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

    tableNumber: {
      type: Number,
    },

    items: [
      {
        menuItemId: {
          type: mongoose.Schema.ObjectId,
          ref: "menuItems",
        },

        name: {
          type: String,
        },

        price: {
          type: Number,
        },

        image_url: {
          type: String,
        },

        options: {
          type: String,
          default: "",
        },

        orderCount: {
          type: Number,
        },

        quantity: {
          type: Number,
        },

        loadingQuantity: {
          type: Number,
        },

        finishedQuantity: {
          type: Number,
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

        return ret;
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
