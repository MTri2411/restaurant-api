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

exports.getAllReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find()
    .populate({
      path: "menuItemId",
      select: "name",
    })
    .populate({
      path: "userId",
      select: "fullName",
    });

  res.status(200).json({
    status: "success",
    data: reviews,
  });
});

exports.getMenuItemsForReview = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const orders = await Order.find({
    userId,
    paymentStatus: "paid",
    "items.reviewed": false,
  });

  const menuItemIds = orders.flatMap((order) =>
    order.items.filter((item) => !item.reviewed).map((item) => item.menuItemId)
  );

  const menuItemIdsUnique = [...new Set(menuItemIds)];

  const menuItems = await MenuItem.find({
    _id: { $in: menuItemIdsUnique },
  }).select("name image_url rating");

  res.status(200).json({
    status: "success",
    total: menuItems.length,
    data: menuItems,
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  checkSpellFields(["rating", "comment"], req.body);

  const userId = req.user._id;
  const { rating, comment } = req.body;
  const { menuItemId } = req.params;

  const orders = await Order.find({
    userId,
    paymentStatus: "paid",
    items: { $elemMatch: { menuItemId, reviewed: false } },
  });

  if (orders.length === 0) {
    return next(
      new AppError(
        "You have not ordered this item or it has already been reviewed.",
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

  await Order.updateMany(
    { userId, paymentStatus: "paid", "items.menuItemId": menuItemId },
    { $set: { "items.$[elem].reviewed": true } },
    { arrayFilters: [{ "elem.menuItemId": menuItemId }] }
  );

  const menuItem = await MenuItem.findById(menuItemId);
  const reviews = await Review.find({ menuItemId });
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  menuItem.rating = totalRating / reviews.length;

  menuItem.reviews.push(review._id);
  await menuItem.save();

  res.status(201).json({
    status: "success",
    data: review,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  checkSpellFields(["rating", "comment"], req.body);
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError("No review found with this ID", 404));
  }

  const now = new Date();
  const oneDayInMilliseconds = 1 * 24 * 60 * 60 * 1000;

  if (now - review.createdAt > oneDayInMilliseconds) {
    return next(
      new AppError("You can only update your review within 1 day", 400)
    );
  }

  if (
    review.updatedAt &&
    review.updatedAt - review.createdAt < oneDayInMilliseconds
  ) {
    return next(new AppError("You can only update your review once", 400));
  }

  review.rating = rating;
  review.comment = comment;
  review.updatedAt = now;
  await review.save();

  const menuItem = await MenuItem.findById(review.menuItemId);
  const reviews = await Review.find({ menuItemId: menuItem._id });
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  menuItem.rating = totalRating / reviews.length;
  await menuItem.save();

  res.status(200).json({
    status: "success",
    data: review,
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError("No review found with this ID", 404));
  }

  const menuItem = await MenuItem.findById(review.menuItemId);

  menuItem.reviews = menuItem.reviews.filter(
    (review) => review.toString() !== reviewId
  );

  const reviews = await Review.find({ menuItemId: menuItem._id });

  if (reviews.length === 0) {
    menuItem.rating = 0;
  }

  await menuItem.save();
  await Review.findByIdAndDelete(reviewId);

  res.status(200).json({
    status: "success",
    message: "Deleted successfully",
    data: review,
  });
});

exports.getUserReviews = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const reviews = await Review.find({ userId })
    .populate({ path: "menuItemId", select: "name" })
    .sort({ createdAt: "desc" });

  res.status(200).json({
    status: "success",
    data: reviews,
  });
});
