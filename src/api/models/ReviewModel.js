const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "user id is required!"],
    },

    menuItemId: {
      type: mongoose.Schema.ObjectId,
      ref: "menuItems",
      required: [true, "menu item id is required!"],
    },

    orderId: {
      type: mongoose.Schema.ObjectId,
      ref: "orders", 
      required: [true, "order id is required!"],
    },

    rating: {
      type: Number,
      required: [true, "rating is required!"],
      min: [1, "rating must be at least 1"],
      max: [5, "rating must be at most 5"],
    },

    comment: {
      type: String,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.virtual("orders", {
  ref: "Orders",
  localField: "userId",
  foreignField: "userId",
  justOne: false,
});

const Review = mongoose.model("Reviews", reviewSchema);
module.exports = Review;
