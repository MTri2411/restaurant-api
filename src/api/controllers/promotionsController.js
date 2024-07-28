const Promotion = require("../models/PromotionsModel");
const Order = require("../models/OrderModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const mongoose = require("mongoose");
const Handlebars = require("handlebars");
const cron = require("node-cron");

async function updatePromotionStatus() {
  const now = new Date();
  await Promotion.updateMany(
    { endDate: { $lt: now }, isActive: true },
    { isActive: false }
  );
}
cron.schedule("0 0 * * *", updatePromotionStatus);

exports.checkPromotionCode = catchAsync(async (req, res, next) => {
  const { promotionCode } = req.body;
  const { tableId } = req.params;
  const userId = req.query.userId ? req.user._id : undefined;

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

  let orders;
  if (userId) {
    orders = await Order.find({ tableId: tableId, userId: userId });
  } else {
    orders = await Order.find({ tableId: tableId });
  }

  if (!orders.length) {
    return next(new AppError("No orders found for this table", 404));
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

  let totalAmount = orders.reduce((acc, curr) => acc + curr.amount, 0);

  if (promotion.minOrderValue && totalAmount < promotion.minOrderValue) {
    return next(
      new AppError(
        `The order value must be at least ${promotion.minOrderValue} to apply this promotion.`,
        400
      )
    );
  }

  const finalTotal = calculateDiscount(totalAmount, promotion);

  Object.assign(req, { promotion, finalTotal });

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
  const now = new Date();

  if (req.query.isActive === "true") {
    query = {
      startDate: { $lte: now },
      endDate: { $gte: now },
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
  const requiredFields = [
    "code",
    "discount",
    "discountType",
    "startDate",
    "endDate",
    "maxDiscount",
    "minOrderValue",
    "maxUsage",
    "usageLimitPerUser",
  ];

  checkSpellFields(requiredFields, req.body);

  const validatePromotionFields = (type, body) => {
    const errors = [];
    const { discount, maxDiscount, minOrderValue } = body;

    switch (type) {
      case "maxPercentage":
        if (!maxDiscount || !minOrderValue) {
          errors.push(
            "A maxPercentage promotion must have maxDiscount and minOrderValue fields"
          );
        }
        if (discount > 100) {
          errors.push("Discount cannot exceed 100% for maxPercentage type");
        }
        break;
      case "percentage":
        if (maxDiscount) {
          errors.push(
            "A percentage promotion should not have maxDiscount field"
          );
        }
        if (discount > 100) {
          errors.push("Discount cannot exceed 100% for percentage type");
        }
        break;
      case "fixed":
        if (!discount) {
          errors.push(`A ${type} promotion must have a discount field`);
        }
        if (maxDiscount || minOrderValue) {
          errors.push(
            `A ${type} promotion should not have maxDiscount or minOrderValue fields`
          );
        }
        break;
      default:
        errors.push("Invalid discount type");
    }
    return errors;
  };

  const generateDescription = (type, body) => {
    const { discount, maxDiscount, minOrderValue } = body;

    const templates = {
      fixed: `Giảm {{discount}} tất cả đơn hàng`,
      percentage: `Giảm {{discount}}% đơn tối thiểu {{minOrderValue}}`,
      maxPercentage: `Giảm {{discount}}% giảm tối đa {{maxDiscount}} đơn tối thiểu {{minOrderValue}}`,
    };

    const template = Handlebars.compile(templates[type]);

    const formatCurrency = (value) => {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        currencyDisplay: "code",
      })
        .format(value)
        .replace("VND", "VND");
    };

    const formattedData = {
      discount: type === "fixed" ? formatCurrency(discount) : discount,
      maxDiscount: maxDiscount
        ? formatCurrency(maxDiscount)
        : "không có giới hạn",
      minOrderValue: minOrderValue
        ? formatCurrency(minOrderValue)
        : "không có điều kiện",
    };

    return template(formattedData);
  };
  const errors = validatePromotionFields(req.body.discountType, req.body);
  if (errors.length > 0) {
    return next(new AppError(errors.join(", "), 400));
  }

  if (!req.body.description) {
    req.body.description = generateDescription(req.body.discountType, req.body);
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
    ["code", "startDate", "endDate", "maxUsage", "usageLimitPerUser"],
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

exports.updatePromotionStatus = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findByIdAndUpdate(
    req.params.id,
    { isActive: req.body.isActive },
    { new: true, runValidators: true }
  );

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

  res.status(200).json({
    status: "success",
    message: "Promotion deleted",
    data: null,
  });
});
