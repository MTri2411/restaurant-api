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
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "End date must be after start date!",
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

// Method to check if the promotion is active
promotionSchema.methods.isActivePromotion = function () {
  const currentDate = new Date();
  return (
    this.isActive &&
    currentDate >= this.startDate &&
    currentDate <= this.endDate
  );
};

// Static method to find active promotions
promotionSchema.statics.findActivePromotions = function () {
  const currentDate = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate },
  });
};

const Promotion = mongoose.model("Promotion", promotionSchema);

module.exports = Promotion;
