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
    return next(new AppError("Bình luận chứa từ ngữ không phù hợp.", 400));
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

  const reviews = await Review.find({ userId }).populate({
    path: "menuItemId",
  });

  return res.status(200).json({
    status: "success",
    data: reviews,
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

  // Duyệt qua từng orderId để tìm order chứa menuItemId
  for (let id of orderId) {
    const order = await Order.findById(id);
    if (
      order &&
      order.items.some(
        (item) => item.menuItemId.toString() === menuItemId.toString()
      )
    ) {
      foundOrder = order;
      break;
    }
  }

  // Nếu không tìm thấy đơn hàng nào chứa menuItemId
  if (!foundOrder) {
    return res.status(404).json({
      status: "fail",
      message: "Không tìm thấy đơn hàng chứa món ăn này.",
    });
  }

  // Kiểm tra xem người dùng có phải là người đã đặt hàng không
  if (foundOrder.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      status: "fail",
      message: "Chỉ người đặt hàng mới có thể đánh giá món ăn.",
    });
  }

  // Kiểm tra xem đánh giá đã tồn tại cho đơn hàng này chưa
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

  // Tạo đánh giá mới
  const newReview = await Review.create({
    menuItemId,
    userId,
    orderId: foundOrder._id,
    rating,
    comment,
  });

  // Cập nhật điểm đánh giá cho món ăn
  await updateMenuItemRating(menuItemId);

  // Tăng điểm uy tín cho người dùng
  await User.findByIdAndUpdate(userId, { $inc: { reputationPoints: 10 } });

  return res.status(201).json({
    status: "success",
    data: newReview,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {});

exports.deleteReview = catchAsync(async (req, res, next) => {});
