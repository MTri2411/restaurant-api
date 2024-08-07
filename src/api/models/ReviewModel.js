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

    rating: {
      type: Number,
      required: [true, "rating is required!"],
    },

    comment: {
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
  {
    timestamps: true,
  }
);

const Review = mongoose.model("Reviews", reviewSchema);
module.exports = Review;
