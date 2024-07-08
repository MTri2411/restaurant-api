const Promotion = require("../models/PromotionsModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");

exports.getAllPromotions = catchAsync(async (req, res, next) => {
  const promotions = await Promotion.find();
  res.status(200).json({
    status: "success",
    data: {
      promotions,
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

  const promotion = await Promotion.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      promotion,
    },
  });
});

exports.getPromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new AppError("No promotion found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      promotion,
    },
  });
});
