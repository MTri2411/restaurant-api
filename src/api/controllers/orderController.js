const Order = require("../models/OrderModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");

exports.createOrder = catchAsync(async (req, res, next) => {
  checkSpellFields(["items"], req.body);

  const { userId, tableId } = req.params;
  const { items } = req.body;

  // Find the existing order
  let existingOrder = await Order.findOne({ userId, tableId });

  if (existingOrder) {
    for (let newItem of items) {
      newItem.createdAt = Date.now();
      existingOrder.items.push(newItem);
    }

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      existingOrder._id,
      existingOrder,
      { new: true, runValidators: true }
    ).populate({
      path: "items.menuItem",
      select: "name engName price image_url rating",
    });

    return res.status(200).json({
      status: "success",
      data: updatedOrder,
    });
  }

  await Order.create({ userId, tableId, items });

  const newOrder = await Order.findOne({ userId, tableId }).populate({
    path: "items.menuItem",
    select: "name engName price image_url rating",
  });

  res.status(201).json({
    status: "success",
    data: newOrder,
  });
});

exports.deleteOrderItem = catchAsync(async (req, res, next) => {
  const { userId, tableId, itemId } = req.params;

  // Find the existing order
  let existingOrder = await Order.findOne({
    userId,
    tableId,
  });

  if (!existingOrder) {
    return next(new AppError("No order found with this ID", 404));
  }

  // Find the existing item in order
  let existingOrderItem = existingOrder.items.find(
    (item) => item._id.toString() === itemId
  );

  if (!existingOrderItem) {
    return next(new AppError("No item found with this ID", 404));
  }

  // Time allowed for delete = 1p30s
  const timeAllowedForDelete =
    (Date.now() - Date.parse(existingOrderItem.createdAt)) / 1000;

  if (timeAllowedForDelete > 90) {
    return next(new AppError("Time out to delete", 400));
  }

  // Delete item in orders.items database
  await Order.updateOne(
    { userId, tableId },
    { $pull: { items: { _id: itemId } } }
  );

  res.status(200).json({
    status: "success",
    data: existingOrderItem,
  });
});
