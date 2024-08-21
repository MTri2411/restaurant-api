const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "orders",
      },
    ],

    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },

    amount: {
      type: Number,
    },

    voucher: {
      type: String,
    },

    amountDiscount: {
      type: Number,
    },

    paymentMethod: {
      type: String,
    },

    appTransactionId: {
      type: String,
    },

    zpTransactionId: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual
paymentSchema.virtual("orderId.order", {
  ref: "orders",
  localField: "orderId",
  foreignField: "_id",
});

paymentSchema.virtual("orderId.userId", {
  ref: "User",
  localField: "orderId",
  foreignField: "_id",
});

paymentSchema.virtual("userId.user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
});

const Payment = mongoose.model("payments", paymentSchema);
module.exports = Payment;
