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

  let finalTotal = totalAmount;
  if (req.promotion) {
    finalTotal = req.finalTotal;
  }

  res.status(200).json({
    success: "success",
    totalOrders: items.length,
    totalAmount: finalTotal,
    discountAmount: totalAmount - finalTotal,
    data: items,
  });
});

exports.createOrder = catchAsync(async (req, res, next) => {
  checkSpellFields(["items"], req.body);

  const userId = req.user._id;
  const { tableId } = req.params;
  const { items } = req.body;

  let amount = 0;

  for (const item of items) {
    // Find the existing menu item
    const existingMenuItem = await MenuItem.findOne({ _id: item.menuItemId });

    if (!existingMenuItem) {
      return next(new AppError("Menu item is not on the menu", 404));
    }

    amount += existingMenuItem.price * item.quantity;
  }

  // Find the existing order
  let existingOrder = await Order.findOne({
    userId,
    tableId,
    paymentStatus: "unpaid",
  });

  if (existingOrder) {
    for (let newItem of items) {
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
  const { tableId, menuItemId } = req.params;
  const { createdAt } = req.body;
  const dateFromBody = new Date(createdAt);
  const dateStart = new Date(dateFromBody.getTime() - 3000);
  const dateEnd = new Date(dateFromBody.getTime() + 3000);

  await Order.updateMany(
    {
      tableId: tableId,
      items: {
        $elemMatch: {
          menuItemId: menuItemId,
          createdAt: {
            $gte: dateStart,
            $lt: dateEnd,
          },
        },
      },
    },
    { $set: { "items.$[el].status": "finished" } },
    {
      arrayFilters: [
        {
          "el.menuItemId": menuItemId,
          "el.createdAt": {
            $gte: dateStart,
            $lt: dateEnd,
          },
        },
      ],
    }
  );

  const updatedOrderItems = await Order.find({
    items: {
      $elemMatch: {
        menuItemId: menuItemId,
        createdAt: {
          $gte: dateStart,
          $lt: dateEnd,
        },
      },
    },
  }).populate({
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

// exports.deleteOrderItem = catchAsync(async (req, res, next) => {
//   const { tableId, menuItemId } = req.params;
//   const { options } = req.body;
//   const userId = req.user._id;

//   const timeForDelete = new Date(Date.now() - 180000);
//   const user = await User.findOne({ _id: userId }, { role: 1 });

//   // if (
//   //   user._id.toString() !== existingOrder[0].userId.toString() &&
//   //   user.role !== "staff"
//   // ) {
//   //   return next(new AppError("You cannot delete other people's item", 400));
//   // }

//   await Order.updateOne(
//     {
//       tableId,
//       userId,
//       paymentStatus: "unpaid",
//     },
//     {
//       $pop: {
//         items: {
//           menuItemId,
//           options,
//           createdAt: { $gte: timeForDelete },
//         },
//       },
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     message: `Deleted successfully!!!`,
//   });
// });

// exports.updateItemStatus = catchAsync(async (req, res, next) => {
//   const { tableId } = req.params;
//   const { updateAll, itemIds } = req.body;

//   let order = await Order.findOne({ tableId, paymentStatus: "unpaid" });

//   if (!order) {
//     return next(new AppError("No order found with this table ID", 404));
//   }

//   // Kiểm tra nếu cần cập nhật tất cả items
//   if (updateAll) {
//     order.items.forEach((item) => {
//       if (item.status === "loading") {
//         item.status = "finished";
//       }
//     });
//   } else {
//     // Cập nhật các items cụ thể
//     itemIds.forEach((itemId) => {
//       const item = order.items.find((item) => item._id.toString() === itemId);
//       if (item && item.status === "loading") {
//         item.status = "finished";
//       }
//     });
//   }

//   await order.save();

//   res.status(200).json({
//     status: "success",
//     data: order,
//   });
// });
