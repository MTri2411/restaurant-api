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
    return next(new AppError("Bình luận chứa ngôn từ không phù hợp.", 400));
  }

  req.body.comment = cleanComment(comment);
  next();
};

async function updateMenuItemRating(menuItemId) {
  const reviews = await Review.find({ menuItemId });
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  const avgRating = totalRating / reviews.length;

  await MenuItem.findByIdAndUpdate(menuItemId, { rating: avgRating });
}

exports.getMyReviews = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const reviews = await Review.find({ userId }).select(
    "rating comment orderId menuItemId createdAt"
  );
  if (!reviews.length) {
    return next(new AppError("No reviews found for this user", 404));
  }

  const user = await User.findById(userId).select("fullName");
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const results = await Promise.all(
    reviews.map(async (review) => {
      const menuItem = await MenuItem.findById(review.menuItemId).select(
        "name image_url"
      );
      if (!menuItem) {
        return next(new AppError("Menu item not found", 404));
      }

      const order = await Order.findById(review.orderId).select(
        "items createdAt"
      );
      if (!order) {
        return next(new AppError("Order not found", 404));
      }

      const item = order.items.find(
        (item) => item.menuItemId.toString() === review.menuItemId.toString()
      );
      const options = item ? item.options : [];

      return {
        user: {
          fullName: user.fullName,
        },
        review: {
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        },
        menuItem: {
          name: menuItem.name,
          image_url: menuItem.image_url,
        },
        order: {
          createdAt: order.createdAt,
        },
        options,
      };
    })
  );

  res.status(200).json({
    status: "success",
    data: results,
  });
});

exports.getAllReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find()
    .populate({
      path: "userId",
      select: "fullName img_avatar_url reputationPoints",
    })
    .populate({
      path: "orderId",
      select: "createdAt",
    })
    .populate({
      path: "menuItemId",
      select: "name image_url",
    });

  const formattedReviews = reviews.map((review) => ({
    ...review.toObject(),
    orderCreatedAt: review.orderId.createdAt,
  }));

  return res.status(200).json({
    status: "success",
    data: formattedReviews,
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  const { menuItemId, rating, comment, orderId } = req.body;
  const userId = req.user._id;

  let foundOrder = null;

  for (let id of orderId) {
    const order = await Order.findById(id);
    if (
      order &&
      order.items.some(
        (item) => item.menuItemId.toString() === menuItemId.toString()
      ) &&
      order.userId.toString() === userId.toString()
    ) {
      foundOrder = order;
      break;
    }
  }

  if (!foundOrder) {
    return res.status(403).json({
      status: "fail",
      message:
        "Chỉ người đã đặt món ăn trong đơn hàng của họ mới có thể đánh giá món ăn.",
    });
  }

  const existingReview = await Review.findOne({
    userId,
    menuItemId,
    orderId: foundOrder._id,
  });

  if (existingReview) {
    return res.status(400).json({
      status: "fail",
      message: "Bạn đã đánh giá món ăn này trong đơn hàng này.",
    });
  }

  const newReview = await Review.create({
    menuItemId,
    userId,
    orderId: foundOrder._id,
    rating,
    comment,
  });

  await updateMenuItemRating(menuItemId);

  await User.findByIdAndUpdate(userId, { $inc: { reputationPoints: 10 } });

  return res.status(201).json({
    status: "success",
    data: newReview,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {});

exports.deleteReview = catchAsync(async (req, res, next) => {});
