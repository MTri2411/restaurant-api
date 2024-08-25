const Promotion = require("../models/PromotionsModel");
const Order = require("../models/OrderModel");
const Payment = require("../models/PaymentModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const mongoose = require("mongoose");
const Handlebars = require("handlebars");
const cron = require("node-cron");
const moment = require("moment-timezone");

// async function updatePromotionStatus() {
//   const now = moment.tz("Asia/Ho_Chi_Minh").toDate();
//   await Promotion.updateMany(
//     {
//       $or: [
//         { endDate: { $lt: now } },
//         { $expr: { $lte: ["$maxUsage", "$usedCount"] } },
//       ],
//     },
//     { isActive: false }
//   );
// }

// cron.schedule("0 0 * * *", updatePromotionStatus);

exports.checkPromotionCode = catchAsync(async (req, res, next) => {
  const promotionCode = req.query.promotionCode || req.body.promotionCode;
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
    req.promotionError = "Mã khuyến mãi không hợp lệ";
    return next();
  }

  if (!promotion) {
    const expiredPromotion = await Promotion.findOne({ code: promotionCode });
    req.promotionError = expiredPromotion
      ? `Mã khuyến mãi không hợp lệ. Mã này đã hết hạn vào ${expiredPromotion.endDate.toISOString()}`
      : "Mã khuyến mãi không hợp lệ";
    return next();
  }

  if (promotion.maxUsage && promotion.usedCount >= promotion.maxUsage) {
    req.promotionError = "Mã khuyến mãi đã hết lượt sử dụng";
    return next();
  }

  if (userId) {
    const user = await User.findById(userId);
    const usedPromotion = user.usedPromotions.find(
      (usedPromotion) =>
        usedPromotion.promotion.toString() === promotion._id.toString()
    );

    if (
      usedPromotion &&
      usedPromotion.timesUsed >= promotion.usageLimitPerUser
    ) {
      req.promotionError =
        "Mã khuyến mãi đã hết lượt sử dụng cho tài khoản của bạn";
      return next();
    }
  }

  const orderQuery = userId ? { tableId, userId } : { tableId };

  const orders = await Order.find({ ...orderQuery, paymentStatus: "unpaid" });

  if (!orders.length) {
    req.promotionError = "Không có đơn hàng nào để áp dụng mã khuyến mãi";
    return next();
  }
  const totalAmount = orders.reduce((acc, order) => acc + order.amount, 0);

  if (promotion.minOrderValue && totalAmount < promotion.minOrderValue) {
    req.promotionError = `Đơn hàng phải có giá trị tối thiểu ${new Intl.NumberFormat(
      "vi-VN",
      { style: "currency", currency: "VND", currencyDisplay: "code" }
    ).format(promotion.minOrderValue)}`;
    return next();
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
  let query = {};
  if (req.params.id) {
    query._id = req.params.id;
  } else if (req.query.code) {
    query.code = req.query.code;
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

  const validatePromotionFields = ({
    discountType,
    discount,
    maxDiscount,
    minOrderValue,
  }) => {
    const errors = [];

    if (discount >= 100 && discountType !== "fixed") {
      errors.push(
        "Discount cannot exceed 100% for percentage or maxPercentage type"
      );
    }

    if (discountType === "maxPercentage") {
      if (!maxDiscount || !minOrderValue) {
        errors.push(
          "A maxPercentage promotion must have maxDiscount and minOrderValue fields"
        );
      }
    } else if (discountType === "percentage") {
      if (maxDiscount) {
        errors.push("A percentage promotion should not have maxDiscount field");
      }
    } else if (discountType === "fixed") {
      if (maxDiscount || minOrderValue) {
        errors.push(
          "A fixed promotion should not have maxDiscount or minOrderValue fields"
        );
      }
    } else {
      errors.push("Invalid discount type");
    }

    return errors;
  };

  const generateDescription = ({
    discountType,
    discount,
    maxDiscount,
    minOrderValue,
  }) => {
    const templates = {
      fixed: `Giảm {{discount}} tất cả đơn hàng`,
      percentage: minOrderValue
        ? `Giảm {{discount}}% đơn tối thiểu {{minOrderValue}}`
        : `Giảm {{discount}}% tất cả đơn hàng`,
      maxPercentage: `Giảm {{discount}}% giảm tối đa {{maxDiscount}} đơn tối thiểu {{minOrderValue}}`,
    };

    const template = Handlebars.compile(templates[discountType]);

    const formatCurrency = (value) =>
      new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        currencyDisplay: "code",
      })
        .format(value)
        .replace("VND", "VND");

    const formattedData = {
      discount: discountType === "fixed" ? formatCurrency(discount) : discount,
      maxDiscount: maxDiscount ? formatCurrency(maxDiscount) : "",
      minOrderValue: minOrderValue ? formatCurrency(minOrderValue) : "",
    };

    return template(formattedData);
  };

  const generateCode = ({
    discountType,
    discount,
    maxDiscount,
    minOrderValue,
  }) => {
    let code = discountType.toUpperCase() + discount;

    if (maxDiscount) {
      code += `MAX${Math.round(maxDiscount / 1000)}K`;
    }
    if (minOrderValue) {
      code += `MIN${Math.round(minOrderValue / 1000)}K`;
    }

    return code;
  };

  const errors = validatePromotionFields(req.body);
  if (errors.length > 0) {
    return next(new AppError(errors.join(", "), 400));
  }

  if (!req.body.description) {
    req.body.description = generateDescription(req.body);
  }

  if (!req.body.code) {
    req.body.code = generateCode(req.body);
  }

  Object.keys(req.body).forEach(
    (key) =>
      (req.body[key] == null || req.body[key] === "") && delete req.body[key]
  );

  req.body.usedCount = 0;
  req.body.isActive = true;

  console.log(req.body);
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
    ["startDate", "endDate", "maxUsage", "usageLimitPerUser"],
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
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new AppError("Promotion not found", 404));
  }

  if (promotion.endDate < new Date()) {
    return next(
      new AppError(
        `Promotion has expired on ${promotion.endDate.toISOString()}. Please update the end date`,
        400
      )
    );
  }

  if (promotion.maxUsage <= promotion.usedCount) {
    return next(
      new AppError(
        `Promotion has reached its usage limit of ${promotion.maxUsage}. Please update the maxUsage`,
        400
      )
    );
  }

  promotion.isActive = !promotion.isActive;
  await promotion.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: {
      promotion,
    },
  });
});

exports.resetAllPromotions = catchAsync(async (req, res, next) => {
  const now = new Date();

  const expiredPromotions = await Promotion.find({
    $or: [
      { endDate: { $lt: now } },
      { $expr: { $eq: ["$usedCount", "$maxUsage"] } },
    ],
  });

  if (expiredPromotions.length === 0) {
    return next(new AppError("No promotions to reset", 404));
  }

  const updates = expiredPromotions.map((promotion) => {
    const updateFields = {};
    const newEndDate = new Date();

    if (promotion.endDate < now) {
      newEndDate.setDate(newEndDate.getDate() + 7);
      newEndDate.setHours(23, 59, 59, 999);
      updateFields.endDate = newEndDate;
    }

    if (promotion.usedCount === promotion.maxUsage) {
      updateFields.maxUsage = promotion.maxUsage + 10;
    }

    if (promotion.endDate < now && promotion.usedCount === promotion.maxUsage) {
      updateFields.isActive = true;
    }

    return Promotion.updateOne({ _id: promotion._id }, { $set: updateFields });
  });

  await Promise.all(updates);

  res.status(200).json({
    status: "success",
    message: "Expired promotions have been updated",
    data: expiredPromotions,
  });
});

exports.deletePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);
  if (promotion.usedCount > 0) {
    return next(
      new AppError("Promotion has been used. Cannot delete this promotion", 400)
    );
  }

  const payment = await Payment.findOne({ voucher: promotion.code });
  if (payment) {
    return next(
      new AppError(
        "Promotion has been used in a payment. Cannot delete this promotion",
        400
      )
    );
  }

  await Promotion.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: "success",
    message: "Promotion deleted successfully",
    data: null,
  });
});
