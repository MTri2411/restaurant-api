const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      unique: true,
      uppercase: true,
      required: [true, "A promotion must have a code!"],
    },

    description: {
      type: String,
      trim: true,
      required: [true, "A promotion must have a description!"],
    },

    discount: {
      type: Number,
      required: [true, "A promotion must have a discount!"],
    },

    discountType: {
      type: String,
      enum: ["fixed", "percentage", "maxPercentage"],
      required: [true, "A promotion must have a discount type!"],
    },

    maxDiscount: {
      type: Number,
      required: function () {
        return this.discountType === "maxPercentage";
      },
    },

    minOrderValue: {
      type: Number,
      required: function () {
        return this.discountType === "maxPercentage";
      },
    },
    startDate: {
      type: Date,
      required: [true, "A promotion must have a start date!"],
    },

    endDate: {
      type: Date,
      required: [true, "A promotion must have an end date!"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Promotion = mongoose.model("promotions", promotionSchema);

module.exports = Promotion;
