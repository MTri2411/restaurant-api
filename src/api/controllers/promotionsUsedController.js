const mongoose = require("mongoose");
const User = require("../models/UserModel");
const Promotion = require("../models/PromotionsModel");
const PromotionsUsed = require("../models/PromotionsUsedModel");
const Order = require("../models/OrderModel");
const Payment = require("../models/PaymentModel");
const catchAsync = require("../utils/catchAsync");

exports.migratePromotionsUsed = catchAsync(async (req, res, next) => {
  console.log("Bắt đầu chuyển dữ liệu...");
  try {
    await mongoose.connect(
      `mongodb+srv://trilmps27011:240917aA@cluster0.8z7hvl9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    // Lấy tất cả các Payment có voucher (mã khuyến mãi)
    const payments = await Payment.find({ voucher: { $exists: true } });
    console.log(`Tìm thấy ${payments.length} thanh toán có mã khuyến mãi`);

    // Duyệt qua từng Payment để lấy thông tin
    for (const payment of payments) {
      const { userId, orderId, voucher: promotionCode } = payment;
      console.log("Đang xử lý thanh toán có orderId: ", orderId);

      // Tìm promotion theo promotionCode
      const promotion = await Promotion.findOne({ promotionCode });
      if (!promotion) {
        console.log(
          `Không tìm thấy promotion với mã khuyến mãi: ${promotionCode}`
        );
        continue;
      }

      // Kiểm tra user có tồn tại không
      const user = await User.findById(userId);
      if (!user) {
        console.log(`Không tìm thấy người dùng với ID: ${userId}`);
        continue;
      }

      // Tạo dữ liệu promotionsUsed mới
      const newPromotionsUsed = {
        userId,
        promotionId: promotion._id,
        orderId,
        usageCount: 1, // Giả định là mỗi thanh toán chỉ sử dụng mã khuyến mãi một lần
        version: promotion.version || 1, // Sử dụng version của promotion, nếu có
      };

      // Lưu dữ liệu promotionsUsed mới vào DB
      await PromotionsUsed.create(newPromotionsUsed);
      console.log(
        `Đã chuyển dữ liệu mã khuyến mãi của người dùng có ID: ${userId} sang bảng mới`
      );
    }

    console.log("Chuyển dữ liệu hoàn tất!");
    mongoose.connection.close();

    res.status(200).json({
      status: "success",
      message: "Chuyển dữ liệu hoàn tất!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Đã xảy ra lỗi trong quá trình chuyển dữ liệu.",
    });
  }
});

exports.createPromotionsUsed = catchAsync(async (req, res, next) => {
  const { userId, promotionId, orderId, usageCount, version } = req.body;

  const newPromotionsUsed = {
    userId,
    promotionId,
    orderId,
    usageCount,
    version,
  };

  const promotionsUsed = await PromotionsUsed.create(newPromotionsUsed);

  res.status(201).json({
    status: "success",
    data: {
      promotionsUsed,
    },
  });
});
