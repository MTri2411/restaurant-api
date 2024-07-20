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

const Payment = mongoose.model("payments", paymentSchema);
module.exports = Payment;
