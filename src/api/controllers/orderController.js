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
      // Check existing item with the same menuItemId and options
      const existingItemIndex = existingOrder.items.findIndex(
        (existingItem) =>
          existingItem.menuItemId.toString() === newItem.menuItemId &&
          existingItem.options === newItem.options
      );

      if (existingItemIndex !== -1) {
        // If item already exists, update its quantity
        existingOrder.items[existingItemIndex].quantity += newItem.quantity;
      } else {
        // If item does not exist, add it to the items array
        existingOrder.items.push(newItem);
      }
    }

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      existingOrder._id,
      existingOrder,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      status: "success",
      data: updatedOrder,
    });
  }

  const newOrder = await Order.create({ userId, tableId, items });

  res.status(201).json({
    status: "success",
    data: newOrder,
  });
});
