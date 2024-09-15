const Promotion = require("../models/PromotionsModel");
const PromotionUsed = require("../models/PromotionsUsedModel");
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

async function updatePromotionStatus() {
  const now = moment.tz("Asia/Ho_Chi_Minh").toDate();
  await Promotion.updateMany(
    {
      $or: [
        { endDate: { $lt: now } },
        { $expr: { $lte: ["$maxUsage", "$usedCount"] } },
      ],
    },
    { isActive: false }
  );
}

cron.schedule("0 0 * * *", updatePromotionStatus);

exports.checkPromotionCode = catchAsync(async (req, res, next) => {
  const promotionCode = req.query.promotionCode || req.body.promotionCode;
  const { tableId } = req.params;
  const userId = req.query.userId ? req.user._id : undefined;
  const userIDfromToken = req.user._id;
  const userIdCash = req.body.userIdCash;

  if (!promotionCode) {
    return next();
  }

  const promotion = await Promotion.findOne({
    code: promotionCode,
    isActive: true,
  });

  if (!promotion) {
    req.promotionError = "Mã khuyến mãi không tồn tại";
    return next();
  }
  const checkUserId = userId || userIDfromToken || userIdCash;

  if (promotion.requiredPoints) {
    const user = await User.findById(checkUserId);
    if (!user) {
      req.promotionError = "Người dùng không tồn tại";
      return next();
    }

    if (user.reputationPoints < promotion.requiredPoints) {
      req.promotionError = `Bạn cần ${promotion.requiredPoints} điểm để sử dụng mã này`;
      return next();
    }

    const redeemedPromotion = user.promotionsRedeemed?.find(
      (p) => p.promotionCode === promotionCode
    );

    if (!redeemedPromotion) {
      req.promotionError = "Bạn chưa đổi mã này và không thể sử dụng nó";
      return next();
    }

    const orderQuery = userId ? { tableId, userId } : { tableId };
    const orders = await Order.find({ ...orderQuery, paymentStatus: "unpaid" });

    if (!orders.length) {
      req.promotionError = "Không có đơn hàng nào để áp dụng mã khuyến mãi";
      return next();
    }

    const totalAmount = orders.reduce((acc, order) => acc + order.amount, 0);

    Object.assign(req, {
      promotion,
      finalTotal: calculateDiscount(totalAmount, promotion),
    });
    return next();
  }

  if (promotion.endDate < new Date()) {
    req.promotionError =
      "Mã khuyến mãi đã hết hạn vào lúc " + promotion.endDate;
    return next();
  }

  if (promotion.maxUsage && promotion.usedCount >= promotion.maxUsage) {
    req.promotionError = "Mã khuyến mãi đã hết lượt sử dụng";
    return next();
  }

  if (checkUserId) {
    const promotionUsed = await PromotionUsed.findOne({
      userId: checkUserId,
      promotionId: promotion._id,
      version: promotion.version,
    });

    if (
      promotionUsed &&
      promotionUsed.usageCount >= promotion.usageLimitPerUser
    ) {
      req.promotionError =
        "Mã khuyến mãi đã hết lượt sử dụng cho người dùng này";
      return next();
    }

    const user = await User.findById(checkUserId);
    if (!user) {
      req.promotionError = "Người dùng không tồn tại";
      return next();
    }

    const redeemedPromotion = user.promotionsRedeemed?.find(
      (p) => p.promotionCode === promotionCode
    );

    if (redeemedPromotion) {
      const orderQuery = userId ? { tableId, userId } : { tableId };
      const orders = await Order.find({
        ...orderQuery,
        paymentStatus: "unpaid",
      });

      if (!orders.length) {
        req.promotionError = "Không có đơn hàng nào để áp dụng mã khuyến mãi";
        return next();
      }

      const totalAmount = orders.reduce((acc, order) => acc + order.amount, 0);

      Object.assign(req, {
        promotion,
        finalTotal: calculateDiscount(totalAmount, promotion),
      });
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
      isActive: true,
    };
  }

  const promotions = await Promotion.find(query);
  promotions.sort((a, b) => b.discount - a.discount);

  res.status(200).json({
    status: "success",
    results: promotions.length,
    data: {
      promotions,
    },
  });
});

exports.getPromotionForClient = catchAsync(async (req, res, next) => {
  const { requiredPoints } = req.query;
  let query = {};

  if (requiredPoints === "true") {
    query = {
      requiredPoints: { $ne: null },
      endDate: null,
    };
  } else if (requiredPoints === "false") {
    query = {
      requiredPoints: null,
      endDate: { $gte: new Date() },
    };
  }

  const promotions = await Promotion.find({
    isActive: true,
    ...query,
  });

  res.status(200).json({
    status: "success",
    results: promotions.length,
    data: {
      promotions,
    },
  });
});

const validatePromotionFields = ({
  discountType,
  discount,
  maxDiscount,
  minOrderValue,
  requiredPoints,
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

  if (requiredPoints !== undefined && requiredPoints <= 0) {
    errors.push(
      "A promotion with points must have a valid requiredPoints field"
    );
  }

  return errors;
};

const generateDescription = ({
  discountType,
  discount,
  maxDiscount,
  minOrderValue,
  requiredPoints,
}) => {
  const templates = {
    fixed: `Giảm {{discount}} tất cả đơn hàng${
      requiredPoints ? " với {{requiredPoints}} điểm" : ""
    }`,
    percentage: minOrderValue
      ? `Giảm {{discount}}% đơn tối thiểu {{minOrderValue}}${
          requiredPoints ? " với {{requiredPoints}} điểm" : ""
        }`
      : `Giảm {{discount}}% tất cả đơn hàng${
          requiredPoints ? " với {{requiredPoints}} điểm" : ""
        }`,
    maxPercentage: `Giảm {{discount}}% giảm tối đa {{maxDiscount}} đơn tối thiểu {{minOrderValue}}${
      requiredPoints ? " với {{requiredPoints}} điểm" : ""
    }`,
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
    requiredPoints: requiredPoints,
  };

  return template(formattedData);
};

const generateCode = ({
  discountType,
  discount,
  maxDiscount,
  minOrderValue,
  requiredPoints,
}) => {
  let code = discountType.toUpperCase() + discount;

  if (maxDiscount) {
    code += `MAX${Math.round(maxDiscount / 1000)}K`;
  }
  if (minOrderValue) {
    code += `MIN${Math.round(minOrderValue / 1000)}K`;
  }
  if (requiredPoints) {
    code += `PTS${requiredPoints}`;
  }

  return code;
};

const createPromotionBase = async (req, res, next, requiredFields) => {
  checkSpellFields(requiredFields, req.body);

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

  const promotion = await Promotion.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      promotion,
    },
  });
};

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

  if (!req.body.startDate || !req.body.endDate) {
    return next(
      new AppError("A promotion must have a startDate and endDate field", 400)
    );
  }

  await createPromotionBase(req, res, next, requiredFields);
});

exports.createPromotionWithPoints = catchAsync(async (req, res, next) => {
  const requiredFields = [
    "discount",
    "discountType",
    "maxDiscount",
    "minOrderValue",
    "requiredPoints",
  ];

  if (!req.body.requiredPoints) {
    return next(
      new AppError(
        "A promotion with points must have a requiredPoints field",
        400
      )
    );
  }

  await createPromotionBase(req, res, next, requiredFields);
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

exports.resetPromotionVersion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new AppError("Promotion not found", 404));
  }

  promotion.version += 1;
  await promotion.save({ validateBeforeSave: false });

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
      new AppError(`Mã khuyến mãi đã hết hạn vào lúc ${promotion.endDate}`, 400)
    );
  }

  if (promotion.maxUsage <= promotion.usedCount) {
    return next(
      new AppError(
        `Mã khuyến mãi đã hết lượt sử dụng (${promotion.usedCount}/${promotion.maxUsage})`,
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
  const promotions = await Promotion.find();
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const newEndDate = new Date(now.getTime() + threeDays);

  await Promotion.updateMany(
    { endDate: { $lt: now } },
    { endDate: newEndDate, isActive: true }
  );

  res.status(200).json({
    status: "success",
    message: "Promotions reset successfully",
  });
});

exports.deletePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);
  if (promotion.usedCount > 0) {
    return next(new AppError("Khuyến mãi đã được sử dụng. Không thể xóa", 400));
  }

  const payment = await Payment.findOne({ voucher: promotion.code });
  if (payment) {
    return next(
      new AppError(
        "Khuyến mãi đã được sử dụng trong các đơn hàng. Không thể xóa",
        400
      )
    );
  }

  const user = await User.findOne({
    promotionsRedeemed: promotion.promotionCode,
  });
  if (user) {
    return next(
      new AppError("Khuyến mãi đã được người dùng đổi. Không thể xóa", 400)
    );
  }

  await Promotion.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: "success",
    message: "Promotion deleted successfully",
    data: null,
  });
});

exports.redeemPromotion = catchAsync(async (req, res, next) => {
  const { promotionCode } = req.body;
  const user = req.user;
  const promotion = await Promotion.findOne({
    code: promotionCode,
    isActive: true,
  });

  if (!promotion) {
    return next(new AppError("Mã khuyến mãi không tồn tại", 404));
  }

  if (!promotion.requiredPoints) {
    return next(new AppError("Mã khuyến mãi này không thể đổi", 400));
  }

  if (user.reputationPoints < promotion.requiredPoints) {
    return next(
      new AppError(
        `Bạn cần ${promotion.requiredPoints} điểm để đổi mã này`,
        400
      )
    );
  } 

  const redeemedPromotion = user.promotionsRedeemed.find(
    (p) => p.promotionCode === promotion.code
  );

  if (redeemedPromotion) {
    redeemedPromotion.usageCount += 1;
    redeemedPromotion.redeemedAt = new Date();
  } else {
    user.promotionsRedeemed.push({
      promotionId: promotion._id,
      promotionCode: promotion.code,
      version: promotion.version,
      usageCount: 1,
    });
  }

  user.reputationPoints -= promotion.requiredPoints;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Đổi mã khuyến mãi thành công",
    data: {
      user,
    },
  });
});