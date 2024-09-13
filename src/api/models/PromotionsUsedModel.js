const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const promotionsUsedSchema = new Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "Promotion used must belong to a user"],
  },
  promotionId: {
    type: mongoose.Schema.ObjectId,
    ref: "Promotion",
    required: [true, "Promotion used must have a promotion ID"],
  },
  orderId: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Order",
      required: [true, "Promotion used must have an order ID"],
    },
  ],
  usageCount: {
    type: Number,
    required: [true, "Promotion used must have a usage count"],
  },
  version: {
    type: Number,
    required: [true, "Promotion used must have a version"],
  },
});

const PromotionsUsed = mongoose.model("PromotionsUsed", promotionsUsedSchema);

module.exports = PromotionsUsed;


