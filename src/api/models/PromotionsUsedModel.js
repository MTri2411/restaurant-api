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
  paymentId: {
    type: mongoose.Schema.ObjectId,
    ref: "Payment",
    required: [true, "Promotion used must have a payment ID"],
  },
  usageCount: {
    type: Number,
  },
  version: {
    type: Number,
  },
});

const PromotionsUsed = mongoose.model("PromotionsUsed", promotionsUsedSchema);

module.exports = PromotionsUsed;
