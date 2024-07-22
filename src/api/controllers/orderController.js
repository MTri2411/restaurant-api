const Order = require("../models/OrderModel");
const MenuItem = require("../models/MenuItemModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");

exports.getOrders = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  const userId = req.query.userId ? req.user._id : undefined;

  let items = [];
  let totalAmount = 0;
  // Get order by table id
  const orders = await Order.find(
    { tableId, ...(userId && { userId }), paymentStatus: "unpaid" },
    {
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }
  ).populate({
    path: "items.menuItemId",
    select: "name engName price image_url rating",
  });

  for (const order of orders) {
    totalAmount += order.amount;
    items.push(...order.items);
  }

  res.status(200).json({
    success: "success",
    totalOrders: items.length,
    totalAmount: totalAmount,
    data: items,
  });
});

// exports.getOrderByTableIdForClient = catchAsync(async (req, res, next) => {
//   const projection = {
//     createdAt: 0,
//     updatedAt: 0,
//     __v: 0,
//   };

//   const { tableId } = req.params;

//   // Get order by table id
//   const orders = await Order.find(
//     { tableId, paymentStatus: "unpaid" },
//     projection
//   ).populate({
//     path: "items.menuItemId",
//     select: "name engName price image_url rating",
//   });

//   // Check if no order found
//   if (orders.length === 0) return next(new AppError("No order found", 404));

//   res.status(200).json({
//     success: "success",
//     totalOrders: orders.length,
//     data: orders,
//   });
// });

// exports.getOrderByUserId = catchAsync(async (req, res, next) => {
//   const projection = {
//     createdAt: 0,
//     updatedAt: 0,
//     __v: 0,
//   };

//   const { _id } = req.user;

//   // Get order by user id
//   const orders = await Order.find(
//     { userId: _id, paymentStatus: "unpaid" },
//     projection
//   ).populate({
//     path: "items.menuItemId",
//     select: "name engName price image_url rating",
//   });

//   res.status(200).json({
//     success: "success",
//     data: orders,
//   });
// });

exports.createOrder = catchAsync(async (req, res, next) => {
  checkSpellFields(["items"], req.body);

  const userId = req.user._id;
  const { tableId } = req.params;
  const { items } = req.body;

  const amount = await items.reduce(async (accumulator, currentValue) => {
    const currentMenuItem = await MenuItem.findById(currentValue.menuItemId);
    return (await accumulator) + currentMenuItem.price * currentValue.quantity;
  }, 0);

  // Find the existing order
  let existingOrder = await Order.findOne({
    userId,
    tableId,
    paymentStatus: "unpaid",
  });

  if (existingOrder) {
    for (let newItem of items) {
      // Find the existing menu item
      const existingMenuItem = await MenuItem.findOne({
        _id: newItem.menuItemId,
      });

      if (!existingMenuItem) {
        return next(new AppError("Menu item is not on the menu", 404));
      }

      newItem.createdAt = Date.now();
      existingOrder.items.push(newItem);
    }

    existingOrder.amount += amount;

    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      existingOrder._id,
      existingOrder,
      { new: true, runValidators: true }
    ).populate({
      path: "items.menuItemId",
      select: "name engName price image_url rating",
    });

    return res.status(200).json({
      status: "success",
      data: updatedOrder,
    });
  }

  await Order.create({ userId, tableId, items, amount });

  const newOrder = await Order.findOne({
    userId,
    tableId,
    paymentStatus: "unpaid",
  }).populate({
    path: "items.menuItemId",
    select: "name engName price image_url rating",
  });

  res.status(201).json({
    status: "success",
    data: newOrder,
  });
});

exports.updateStatusItem = catchAsync(async (req, res, next) => {
  const { tableId, itemId } = req.params;

  // Find the existing order
  let existingOrder = await Order.find(
    {
      tableId,
      paymentStatus: "unpaid",
    },
    {
      items: 1,
    }
  );

  if (existingOrder.length === 0) {
    return next(new AppError("No order found with this ID", 404));
  }

  // Find the existing item in order
  let existingOrderItem;
  existingOrder = existingOrder.filter((eachOrder) => {
    const item = eachOrder.items.find((item) => item._id.toString() === itemId);

    if (item) {
      existingOrderItem = item;
      return true;
    }

    return false;
  });

  if (!existingOrderItem) {
    return next(new AppError("No item found with this ID", 404));
  }

  // Delete item in orders.items database
  const updatedOrderItems = await Order.findByIdAndUpdate(
    existingOrder[0]._id,
    { "items.$[el].status": "finished" },
    {
      arrayFilters: [{ "el._id": itemId }],
      new: true,
      runValidators: true,
    }
  ).populate({
    path: "items.menuItemId",
    select: "price",
  });

  res.status(200).json({
    status: "success",
    data: updatedOrderItems,
  });
});

exports.deleteOrderItem = catchAsync(async (req, res, next) => {
  const { tableId, itemId } = req.params;
  const userId = req.user._id;

  // Find the existing order
  let existingOrder = await Order.find(
    {
      tableId,
      paymentStatus: "unpaid",
    },
    {
      userId: 1,
      items: 1,
    }
  );

  if (existingOrder.length === 0) {
    return next(new AppError("No order found with this ID", 404));
  }

  // Find the existing item in order
  let existingOrderItem;
  existingOrder = existingOrder.filter((eachOrder) => {
    const item = eachOrder.items.find((item) => item._id.toString() === itemId);

    if (item) {
      existingOrderItem = item;
      return true;
    }

    return false;
  });

  if (!existingOrderItem) {
    return next(new AppError("No item found with this ID", 404));
  }

  const user = await User.findOne({ _id: userId }, { role: 1 });
  
  if (
    user._id.toString() !== existingOrder[0].userId.toString() &&
    user.role !== "staff"
  ) {
    return next(new AppError("You cannot delete other people's item", 400));
  }

  const currentDate = Date.now();

  // Time allowed for delete = 3p
  const timeAllowedForDelete =
    (currentDate - Date.parse(existingOrderItem.createdAt)) / 1000;

  if (timeAllowedForDelete > 180) {
    return next(new AppError("Time out to delete", 400));
  }

  // Delete item in orders.items database
  const updatedOrderItems = await Order.findByIdAndUpdate(
    existingOrder[0]._id,
    { $pull: { items: { _id: itemId } } },
    {
      new: true,
      runValidators: true,
    }
  ).populate({
    path: "items.menuItemId",
    select: "price",
  });

  if (updatedOrderItems.items.length > 0) {
    updatedOrderItems.amount = updatedOrderItems.items.reduce(
      (accumulator, currentValue) => {
        return (
          accumulator + currentValue.menuItemId.price * currentValue.quantity
        );
      },
      0
    );

    updatedOrderItems.save();
  } else {
    await Order.deleteOne(updatedOrderItems._id);
  }

  res.status(200).json({
    status: "success",
    message: `Deleted successfully!!!`,
  });
});
