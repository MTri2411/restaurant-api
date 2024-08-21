const Review = require("../models/ReviewModel");
const MenuItem = require("../models/MenuItemModel");
const User = require("../models/UserModel");
const Order = require("../models/OrderModel");
const Payment = require("../models/PaymentModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const profanityList = require("../utils/profanityList");

function containsProfanity(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.some((word) => profanityList.includes(word));
}

function cleanComment(text) {
  return text
    .split(/\s+/)
    .map((word) =>
      profanityList.includes(word.toLowerCase())
        ? "*".repeat(word.length)
        : word
    )
    .join(" ");
}

exports.filterProfanity = (req, res, next) => {
  const { comment } = req.body;

  if (containsProfanity(comment)) {
    return next(new AppError("Comment contains profanity", 400));
  }

  req.body.comment = cleanComment(comment);
  next();
};

exports.createReview = catchAsync(async (req, res, next) => {
  checkSpellFields(["rating", "comment", "menuItemId"], req.body);
  const { rating, comment, menuItemId } = req.body;
  const userId = req.user._id;

  // Tìm payment của user và lấy orderId của đơn hàng gần nhất
  const payment = await Payment.findOne({ userId }).populate({
    path: "orderId",
    populate: { path: "items.menuItem", model: "menuItems" },
  });

  if (!payment) {
    return next(
      new AppError(
        "Can't review a menu item that you haven't ordered before",
        400
      )
    );
  }
  
  const order = payment.orderId.find((order) =>
    order.items.some((item) => item.menuItemId.toString() === menuItemId)
  );

  if (!order) {
    return next(new AppError("The menu item is not found in your orders", 400));
  }

  // Tạo review mới
  const review = await Review.create({
    userId,
    menuItemId,
    rating,
    comment,
  });

  const reviews = await Review.find({ menuItemId });
  const averageRating =
    reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;

  await MenuItem.findByIdAndUpdate(menuItemId, { rating: averageRating });

  const populatedReview = await Review.findById(review._id).populate("order");

  res.status(201).json({
    status: "success",
    data: populatedReview,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {});

exports.deleteReview = catchAsync(async (req, res, next) => {});
