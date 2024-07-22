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

    usedCount: {
      type: Number,
      default: 0,
    },

    maxUsage: {
      type: Number,
    },

    usageLimitPerUser: {
      type: Number,
    },

    startDate: {
      type: Date,
      required: [true, "A promotion must have a start date!"],
      default: function () {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
      },
    },
    endDate: {
      type: Date,
      required: [true, "A promotion must have an end date!"],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "End date must be after start date!",
      },
      default: function () {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        return now;
      },
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

const Promotion = mongoose.model("Promotion", promotionSchema);

module.exports = Promotion;
