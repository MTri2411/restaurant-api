const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const Payment = require("../models/PaymentModel");
const Order = require("../models/OrderModel");

const getStatistics = async (
  Model,
  matchCondition,
  groupBy,
  projectFields,
  sortField,
  limit
) => {
  const stats = await Model.aggregate([
    {
      $match: matchCondition,
    },
    ...(groupBy ? [{ $group: groupBy }] : []),
    ...(projectFields ? [{ $project: projectFields }] : []),
    {
      $sort: { [sortField]: -1 },
    },
    ...(limit ? [{ $limit: limit }] : []),
  ]);

  return stats;
};

const formatGroupBy = (type) => {
  switch (type) {
    case "day":
      return { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    case "week":
      return { $isoWeek: "$createdAt" };
    case "month":
      return { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    case "year":
      return { $year: "$createdAt" };
    default:
      throw new AppError("Invalid statistics type", 400);
  }
};
// Doanh thu theo ngày/tuần/tháng/năm
exports.getRevenueStatistics = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: formatGroupBy(type),
    totalRevenue: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const stats = await getStatistics(
    Payment,
    matchCondition,
    groupBy,
    null,
    "_id"
  );

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Doanh thu trung bình theo ngày/tuần/tháng/năm
exports.getAverageOrderValue = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: formatGroupBy(type),
    totalRevenue: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const projectFields = {
    _id: "$_id",
    totalRevenue: "$totalRevenue",
    totalOrders: "$totalOrders",
    averageOrderValue: {
      $round: [{ $divide: ["$totalRevenue", "$totalOrders"] }, 2],
    }, // Làm tròn đến 2 chữ số thập phân
  };

  const stats = await getStatistics(
    Payment,
    matchCondition,
    groupBy,
    projectFields,
    "_id"
  );

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Số lượng order theo ngày/tuần/tháng/năm
exports.getOrderStatistics = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: formatGroupBy(type),
    totalOrders: { $sum: 1 },
  };

  const stats = await getStatistics(
    Order,
    matchCondition,
    groupBy,
    null,
    "_id"
  );

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Doanh thu theo từng bàn
exports.getRevenueByTable = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$order.tableId",
    totalRevenue: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const stats = await Payment.aggregate([
    { $match: matchCondition },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: "$order" },
    { $group: groupBy },
    { $sort: { totalRevenue: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Doanh thu theo phương thức thanh toán
exports.getRevenueByPaymentMethod = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$paymentMethod",
    totalRevenue: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const stats = await getStatistics(
    Payment,
    matchCondition,
    groupBy,
    null,
    "_id"
  );

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Số lượng món ăn đã bán
exports.getMenuItemStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$items.menuItemId",
    totalQuantity: { $sum: "$items.quantity" },
  };

  const projectFields = {
    _id: "$_id",
    name: "$menuItem.name",
    totalQuantity: "$totalQuantity",
  };

  const stats = await Order.aggregate([
    { $match: matchCondition },
    { $unwind: "$items" },
    { $group: groupBy },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    { $project: projectFields },
    { $sort: { totalQuantity: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Top 5 Món ăn bán chạy nhất
exports.getBestSellingMenuItem = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$items.menuItemId",
    totalQuantity: { $sum: "$items.quantity" },
  };

  const projectFields = {
    _id: "$_id",
    name: "$menuItem.name",
    totalQuantity: "$totalQuantity",
  };

  const stats = await Order.aggregate([
    { $match: matchCondition },
    { $unwind: "$items" },
    { $group: groupBy },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    { $project: projectFields },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Hiệu quả của mã khuyến mãi
exports.getPromotionStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$promotionId",
    totalAmount: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const projectFields = {
    _id: "$_id",
    code: "$promotion.code",
    totalAmount: "$totalAmount",
    totalOrders: "$totalOrders",
  };

  const stats = await Payment.aggregate([
    { $match: matchCondition },
    { $group: groupBy },
    {
      $lookup: {
        from: "promotions",
        localField: "_id",
        foreignField: "_id",
        as: "promotion",
      },
    },
    { $unwind: "$promotion" },
    { $project: projectFields },
    { $sort: { totalAmount: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Số lượng mã khuyến mãi sử dụng
exports.getPromotionUsageStatistics = catchAsync(async (req, res, next) => {});

// Top 5 khách hàng có giá trị cao nhất
exports.getMostValuableCustomer = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const groupBy = {
    _id: "$userId",
    totalAmount: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const projectFields = {
    _id: "$_id",
    name: "$user.name",
    email: "$user.email",
    totalAmount: "$totalAmount",
    totalOrders: "$totalOrders",
  };

  const stats = await Payment.aggregate([
    { $match: matchCondition },
    { $group: groupBy },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $project: projectFields },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});
