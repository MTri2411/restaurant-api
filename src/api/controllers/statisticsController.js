const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const Payment = require("../models/PaymentModel");
const Order = require("../models/OrderModel");
const Review = require("../models/ReviewModel");
const PromotionsUsed = require("../models/PromotionsUsedModel");

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

const getMatchCondition = (startDate, endDate) => {
  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }
  return matchCondition;
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

  const matchCondition = getMatchCondition(startDate, endDate);
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

  const matchCondition = getMatchCondition(startDate, endDate);
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
    },
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

  const matchCondition = getMatchCondition(startDate, endDate);
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

// Doanh thu theo từng bàn theo ngày/tuần/tháng/năm
exports.getRevenueByTable = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  const matchCondition = getMatchCondition(startDate, endDate);
  const groupBy = {
    _id: {
      tableId: "$order.tableId",
      timePeriod: formatGroupBy(type),
    },
    tableNumber: { $first: "$table.tableNumber" },
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
    {
      $lookup: {
        from: "tables",
        localField: "order.tableId",
        foreignField: "_id",
        as: "table",
      },
    },
    { $unwind: "$table" },
    { $group: groupBy },
    {
      $project: {
        _id: 0,
        tableId: "$_id.tableId",
        tableNumber: 1,
        timePeriod: "$_id.timePeriod",
        totalRevenue: 1,
        totalOrders: 1,
      },
    },
    { $sort: { timePeriod: 1, tableId: 1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Doanh thu theo phương thức thanh toán theo ngày/tuần/tháng/năm
exports.getRevenueByPaymentMethod = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  const matchCondition = getMatchCondition(startDate, endDate);
  const groupBy = {
    _id: {
      paymentMethod: "$paymentMethod",
      timePeriod: formatGroupBy(type),
    },
    totalRevenue: { $sum: "$amount" },
    totalOrders: { $sum: 1 },
  };

  const stats = await Payment.aggregate([
    { $match: matchCondition },
    { $group: groupBy },
    {
      $project: {
        _id: 0,
        paymentMethod: "$_id.paymentMethod",
        timePeriod: "$_id.timePeriod",
        totalRevenue: "$totalRevenue",
        totalOrders: "$totalOrders",
      },
    },
    { $sort: { timePeriod: 1, paymentMethod: 1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Số lượng món ăn được đặt theo ngày/tuần/tháng/năm
exports.getMenuItemStatistics = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  const matchCondition = getMatchCondition(startDate, endDate);
  const groupBy = {
    _id: {
      timePeriod: formatGroupBy(type),
      menuItemId: "$items.menuItemId",
    },
    totalQuantity: { $sum: "$items.quantity" },
  };

  const stats = await Order.aggregate([
    { $match: matchCondition },
    { $unwind: "$items" },
    { $group: groupBy },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id.menuItemId",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    {
      $project: {
        _id: 0,
        timePeriod: "$_id.timePeriod",
        menuItemId: "$_id.menuItemId",
        totalQuantity: "$totalQuantity",
        name: "$menuItem.name",
      },
    },
    { $sort: { timePeriod: 1, totalQuantity: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

// Top 5 Món ăn bán chạy nhất theo ngày/tuần/tháng/năm
exports.getBestSellingMenuItem = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  const matchCondition = getMatchCondition(startDate, endDate);
  const groupBy = {
    _id: {
      timePeriod: formatGroupBy(type),
      menuItemId: "$items.menuItemId",
    },
    totalQuantity: { $sum: "$items.quantity" },
  };

  const stats = await Order.aggregate([
    { $match: matchCondition },
    { $unwind: "$items" },
    { $group: groupBy },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id.menuItemId",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    {
      $project: {
        _id: 0,
        timePeriod: "$_id.timePeriod",
        menuItemId: "$_id.menuItemId",
        totalQuantity: "$totalQuantity",
        name: "$menuItem.name",
      },
    },
    {
      $sort: { timePeriod: 1, totalQuantity: -1 },
    },
    {
      $group: {
        _id: "$timePeriod",
        topItems: { $push: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: 0,
        timePeriod: "$_id",
        topItems: { $slice: ["$topItems", 5] },
      },
    },
    { $unwind: "$topItems" },
    {
      $replaceRoot: { newRoot: "$topItems" },
    },
    { $sort: { timePeriod: 1, totalQuantity: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});

exports.getValuableCustomer = catchAsync(async (req, res, next) => {
  const valuableCustomers = await Payment.aggregate([
    {
      $group: {
        _id: "$userId",
        totalAmount: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    {
      $unwind: "$userDetails",
    },
    {
      $match: {
        "userDetails.role": { $ne: "staff" },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$userDetails.fullName",
        totalAmount: 1,
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  res.status(200).json({
    status: "success",
    data: valuableCustomers,
  });
});

exports.getPromotionStatistics = catchAsync(async (req, res, next) => {
  const promotions = await PromotionsUsed.aggregate([
    {
      $group: {
        _id: "$promotionId",
        totalUsed: { $sum: 1 },
        userIds: { $addToSet: "$userId" },
        paymentIds: { $addToSet: "$paymentId" },
      },
    },
    {
      $lookup: {
        from: "promotions",
        localField: "_id",
        foreignField: "_id",
        as: "promotion",
      },
    },
    {
      $unwind: "$promotion",
    },
    {
      $lookup: {
        from: "users",
        localField: "userIds",
        foreignField: "_id",
        as: "users",
      },
    },
    {
      $lookup: {
        from: "payments",
        localField: "paymentIds",
        foreignField: "_id",
        as: "payments",
      },
    },
    {
      $project: {
        _id: 0,
        promotionId: "$_id",
        code: "$promotion.code",
        totalUsed: 1,
        users: {
          $map: {
            input: "$users",
            as: "user",
            in: {
              userId: "$$user._id",
              fullName: "$$user.fullName",
            },
          },
        },
        payments: {
          $map: {
            input: "$payments",
            as: "payment",
            in: {
              paymentId: "$$payment._id",
              amount: "$$payment.amount",
              amountDiscount: "$$payment.amountDiscount",
            },
          },
        },
        totalDiscount: { $sum: "$payments.amountDiscount" },
      },
    },
    {
      $sort: { totalUsed: -1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: promotions,
  });
});

exports.getStatistics = catchAsync(async (req, res, next) => {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Match condition for monthly data
  const matchConditionMonth = {
    createdAt: {
      $gte: startOfMonth,
      $lte: endOfToday,
    },
  };

  // Match condition for yearly data
  const matchConditionYear = {
    createdAt: {
      $gte: startOfYear,
      $lte: endOfToday,
    },
  };

  // Group by day for monthly data
  const groupByDayMonth = {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    totalOrder: { $sum: 1 },
    totalRevenue: { $sum: "$amount" },
  };

  // Group by day for yearly data
  const groupByDayYear = {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    users: { $addToSet: "$userId" },
  };

  // Aggregate monthly data
  const monthlyStats = await Payment.aggregate([
    { $match: matchConditionMonth },
    { $group: groupByDayMonth },
    { $sort: { _id: 1 } },
  ]);

  // Aggregate yearly data
  const yearlyStats = await Payment.aggregate([
    { $match: matchConditionYear },
    { $group: groupByDayYear },
    { $sort: { _id: 1 } },
  ]);

  const orderData = monthlyStats.map((stat) => ({
    date: stat._id,
    totalOrder: stat.totalOrder,
  }));

  const revenueData = monthlyStats.map((stat) => ({
    date: stat._id,
    totalRevenue: stat.totalRevenue,
  }));

  const userData = yearlyStats.map((stat) => ({
    date: stat._id,
    totalUser: stat.users.length,
  }));

  res.status(200).json({
    status: "success",
    data: [
      {
        name: "Bán Hàng",
        data: orderData,
      },
      {
        name: "Doanh Thu",
        data: revenueData,
      },
      {
        name: "Người Dùng",
        data: userData,
      },
    ],
  });
});
