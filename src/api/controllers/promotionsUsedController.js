const mongoose = require("mongoose");
const Payment = require("../models/PaymentModel");
const Promotion = require("../models/PromotionsModel");
const PromotionsUsed = require("../models/PromotionsUsedModel");
const catchAsync = require("../utils/catchAsync");

exports.getPromotionsUsed = catchAsync(async (req, res, next) => {
  const { userId } = req.params; // userId của người dùng

  // Chuyển đổi userId thành ObjectId
  const userObjectId = new mongoose.Types.ObjectId(userId); // Sử dụng từ khóa new

  // Truy vấn các mã khuyến mãi đã sử dụng của userId
  const promotionsUsed = await PromotionsUsed.aggregate([
    {
      $match: { userId: userObjectId }, // Tìm theo userId
    },
    {
      $lookup: {
        from: "payments", // Bảng chứa thanh toán
        localField: "paymentId", // paymentId trong PromotionsUsed
        foreignField: "_id", // _id trong bảng payments
        as: "paymentDetails",
      },
    },
    {
      $unwind: "$paymentDetails", // Giải nén thông tin thanh toán
    },
    {
      $lookup: {
        from: "promotions", // Bảng chứa mã khuyến mãi
        localField: "promotionId", // promotionId trong PromotionsUsed
        foreignField: "_id", // _id trong bảng promotions
        as: "promotionDetails",
      },
    },
    {
      $unwind: "$promotionDetails", // Giải nén thông tin mã khuyến mãi
    },
    {
      $group: {
        _id: {
          voucherCode: "$promotionDetails.code", // Mã khuyến mãi
          paymentId: "$paymentDetails._id", // ID thanh toán
        },
        usageCount: { $sum: "$usageCount" }, // Đếm số lần sử dụng
        totalDiscount: { $sum: "$paymentDetails.amountDiscount" }, // Tính tổng tiền giảm
        title: { $first: "$promotionDetails.description" }, // Lấy tiêu đề hoặc mô tả của mã khuyến mãi
      },
    },
    {
      $project: {
        _id: 0, // Ẩn trường _id
        voucherCode: "$_id.voucherCode", // Hiển thị mã khuyến mãi
        paymentId: "$_id.paymentId", // Hiển thị ID thanh toán
        usageCount: 1, // Số lần sử dụng
        totalDiscount: 1, // Tổng tiền giảm
        title: 1, // Tiêu đề của mã khuyến mãi
      },
    },
  ]);

  // Trả về kết quả
  res.status(200).json({
    status: "success",
    data: {
      promotionsUsed,
    },
  });
});