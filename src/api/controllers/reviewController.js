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

  const payment = await Payment.findOne({
    userId,
    "orderId.items.menuItemId": menuItemId,
  });

  if (!payment) {
    return next(new AppError("You cannot review this item", 400));
  }

  const orderItem = payment.orderId.find((order) =>
    order.items.some((item) => item.menuItemId.toString() === menuItemId)
  );

  if (!orderItem) {
    return next(new AppError("The menu item is not found in your orders", 400));
  }

  const now = new Date();
  const paymentDate = new Date(payment.createdAt);
  const daysSincePayment = (now - paymentDate) / (1000 * 60 * 60 * 24);

  if (daysSincePayment > 3) {
    return next(
      new AppError(
        "You can only review this item within 3 days of payment",
        400
      )
    );
  }

  const review = await Review.create({
    userId,
    menuItemId,
    rating,
    comment,
  });

  const menuItem = await MenuItem.findById(menuItemId);
  menuItem.reviews.push(review._id);
  const reviews = await Review.find({ menuItemId: menuItem._id });
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  menuItem.rating = totalRating / reviews.length;
  await menuItem.save();

  res.status(201).json({
    status: "success",
    data: review,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  checkSpellFields(["rating", "comment"], req.body);
  const { rating, comment } = req.body;
  const reviewId = req.params.id;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError("Review not found", 404));
  }

  if (review.userId.toString() !== req.user._id.toString()) {
    return next(new AppError("You cannot update this review", 403));
  }

  review.rating = rating;
  review.comment = comment;
  await review.save();

  res.status(200).json({
    status: "success",
    data: review,
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {});

exports.getUserReviews = catchAsync(async (req, res, next) => {});
