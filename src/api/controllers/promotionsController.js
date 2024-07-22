const Promotion = require("../models/PromotionsModel");
const Order = require("../models/OrderModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const mongoose = require("mongoose");

exports.checkPromotionCode = catchAsync(async (req, res, next) => {
  const { promotionCode, orders } = req.body;

  if (!promotionCode) {
    return next();
  }

  const promotion = await Promotion.findOne({
    code: promotionCode,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
    isActive: true,
  });

  if (!promotion) {
    return next(new AppError("Invalid or expired promotion code", 400));
  }

  if (promotion.maxUsage && promotion.usedCount >= promotion.maxUsage) {
    return next(
      new AppError("Promotion code has reached its maximum usage", 400)
    );
  }

  if (promotion.usageLimitPerUser) {
    const userIds = orders.map((order) => order.userId);
    const userUsage = await Order.countDocuments({
      userId: { $in: userIds },
      promotion: promotion._id,
    });

    if (userUsage >= promotion.usageLimitPerUser) {
      return next(
        new AppError("Promotion code has reached its usage limit per user", 400)
      );
    }
  }

  // Retrieve all orders at once
  const orderIds = orders.map((order) => order.orderId);
  const orderData = await Order.find({ _id: { $in: orderIds } });

  if (orderData.length !== orders.length) {
    return next(new AppError("One or more orders not found", 404));
  }

  let totalAmount = orderData.reduce((acc, curr) => acc + curr.amount, 0);

  // Check minimum order value for applicable discounts
  if (promotion.minOrderValue && totalAmount < promotion.minOrderValue) {
    return next(
      new AppError(
        `The order value must be at least ${promotion.minOrderValue} to apply this promotion.`,
        400
      )
    );
  }

  // Apply the promotion discount
  let finalTotal = calculateDiscount(totalAmount, promotion);

  req.body.finalTotal = { totalAmount, finalTotal, promotion };

  // Update promotion usage count
  await Promotion.findByIdAndUpdate(promotion._id, {
    $inc: { usedCount: 1 },
  });
  next();
});

function calculateDiscount(totalAmount, promotion) {
  switch (promotion.discountType) {
    case "fixed":
      return Math.max(totalAmount - promotion.discount, 0);
    case "percentage":
      return totalAmount * (1 - promotion.discount / 100);
    case "maxPercentage":
      const discountAmount = totalAmount * (promotion.discount / 100);
      return totalAmount - Math.min(discountAmount, promotion.maxDiscount);
    default:
      return totalAmount;
  }
}

exports.getPromotions = catchAsync(async (req, res, next) => {
  let query = {};

  if (req.query.isActive === "true") {
    query = {
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      isActive: true,
    };
  }

  const promotions = await Promotion.find(query);

  res.status(200).json({
    status: "success",
    results: promotions.length,
    data: {
      promotions,
    },
  });
});

exports.getPromotion = catchAsync(async (req, res, next) => {
  let query;
  if (mongoose.Types.ObjectId.isValid(req.params.id)) {
    query = { _id: req.params.id };
  } else {
    query = { code: req.params.id };
  }

  const promotion = await Promotion.findOne(query);

  if (!promotion) {
    return next(new AppError("Promotion not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      promotion,
    },
  });
});

exports.createPromotion = catchAsync(async (req, res, next) => {
  checkSpellFields(
    [
      "code",
      "description",
      "discount",
      "discountType",
      "startDate",
      "endDate",
      "maxDiscount",
      "minOrderValue",
    ],
    req.body
  );

  const validatePromotionFields = (type, body) => {
    const errors = [];
    switch (type) {
      case "maxPercentage":
        if (!body.maxDiscount || !body.minOrderValue) {
          errors.push(
            "A maxPercentage promotion must have maxDiscount and minOrderValue fields"
          );
        }
        break;
      case "percentage":
      case "fixed":
        if (!body.discount) {
          errors.push(`A ${type} promotion must have a discount field`);
        }
        break;
      default:
        errors.push("Invalid discount type");
    }
    return errors;
  };

  const errors = validatePromotionFields(req.body.discountType, req.body);
  if (errors.length > 0) {
    return next(new AppError(errors.join(", "), 400));
  }

  const promotion = await Promotion.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      promotion,
    },
  });
});

exports.updatePromotion = catchAsync(async (req, res, next) => {
  checkSpellFields(
    [
      "code",
      "description",
      "discount",
      "discountType",
      "startDate",
      "endDate",
      "maxDiscount",
      "minOrderValue",
    ],
    req.body
  );

  const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!promotion) {
    return next(new AppError("Promotion not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      promotion,
    },
  });
});

exports.resetAllPromotions = catchAsync(async (req, res, next) => {
  const now = new Date();
  const startDate = new Date(now.setHours(0, 0, 0, 0));
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setHours(23, 59, 59, 999);

  const result = await Promotion.updateMany(
    { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
    { usedCount: 0, startDate, endDate }
  );

  res.status(200).json({
    status: "success",
    message: "Promotion usage has been reset and dates updated",
    data: result,
  });
});

exports.deletePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findByIdAndDelete(req.params.id);

  if (!promotion) {
    return next(new AppError("Promotion not found", 404));
  }

  res.status(204).json({
    status: "success",
    message: "Promotion deleted",
    data: null,
  });
});
