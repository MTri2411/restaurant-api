const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { validate } = require("./OrderModel");

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
      validate: {
        validator: function (value) {
          if (
            this.discountType === "percentage" ||
            this.discountType === "maxPercentage"
          ) {
            return value <= 100;
          }
          return true;
        },
        message:
          "Discount cannot exceed 100% for percentage or maxPercentage types",
      },
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

    version: { type: Number, default: 1 },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    requiredPoints: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

promotionSchema.virtual("users", {
  ref: "User",
  localField: "_id",
  foreignField: "promotions",
});

promotionSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("End date must be greater than start date"));
  }
  next();
});

promotionSchema.pre("findByIdAndUpdate", function (next) {
  const update = this.getUpdate();
  if (
    update.startDate &&
    update.endDate &&
    update.endDate <= update.startDate
  ) {
    next(new Error("End date must be after start date!"));
  } else if (update.endDate) {
    const docToUpdate = this;
    docToUpdate.model.findOne(this.getQuery(), function (err, doc) {
      if (err) {
        next(err);
      } else if (doc.startDate && update.endDate <= doc.startDate) {
        next(new Error("End date must be after start date!"));
      } else {
        next();
      }
    });
  } else {
    next();
  }
});

const Promotion = mongoose.model("Promotion", promotionSchema);

module.exports = Promotion;
