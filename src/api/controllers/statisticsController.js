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
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
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
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
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

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
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

// Doanh thu theo từng bàn theo ngày/tuần/tháng/năm
exports.getRevenueByTable = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }

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

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }

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

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }

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

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }

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

// Hiệu quả của mã khuyến mãi
exports.getPromotionStatistics = catchAsync(async (req, res, next) => {});

// Số lượng mã khuyến mãi sử dụng
exports.getPromotionUsageStatistics = catchAsync(async (req, res, next) => {});

// Top 5 khách hàng có giá trị cao nhất theo ngày/tuần/tháng/năm
exports.getMostValuableCustomer = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.query;

  let matchCondition = {};
  if (startDate && endDate) {
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lt: adjustedEndDate,
    };
  }

  const groupBy = {
    _id: {
      timePeriod: formatGroupBy(type),
      userId: "$userId",
    },
    totalAmount: { $sum: "$amount" },
  };

  const projectFields = {
    _id: "$_id.userId",
    timePeriod: "$_id.timePeriod",
    totalAmount: "$totalAmount",
  };

  const stats = await Payment.aggregate([
    { $match: matchCondition },
    { $group: groupBy },
    {
      $lookup: {
        from: "users",
        localField: "_id.userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        timePeriod: "$_id.timePeriod",
        userId: "$_id.userId",
        totalAmount: "$totalAmount",
        name: "$user.fullName",
      },
    },
    { $sort: { timePeriod: 1, totalAmount: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    status: "success",
    data: stats,
  });
});
