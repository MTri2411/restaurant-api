const Order = require("../models/OrderModel");
const MenuItem = require("../models/MenuItemModel");
const User = require("../models/UserModel");
const Table = require("../models/TableModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const { finished } = require("nodemailer/lib/xoauth2");

exports.checkUserInTable = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { tableId } = req.params;

  if (user.role === "staff") {
    return next();
  }

  const tableInUse = await Table.findOne(
    { _id: tableId, currentUsers: user._id },
    { tableNumber: 1, currentUsers: 1 }
  );

  if (!tableInUse) {
    return next(new AppError("Người dùng không ở bàn này", 403));
  }

  next();
});

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

  const finalTotal = req.promotion ? req.finalTotal : totalAmount;

  res.status(200).json({
    success: "success",
    totalOrders: items.length,
    totalAmount: finalTotal,
    discountAmount: totalAmount - finalTotal,
    promotionError: req.promotionError,
    voucherCode: req.promotion ? req.promotion.code : undefined,
    data: items,
  });
});

exports.getOrdersForClient = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  const userId = req.query.userId ? req.user._id : undefined;

  const orders = await Order.find(
    { tableId, ...(userId && { userId }), paymentStatus: "unpaid" },
    {
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }
  ).populate({
    path: "userId",
    select: "fullName img_avatar_url role",
  });

  if (orders.length === 0) {
    return res.status(200).json({
      status: "success",
      totalQuantity: 0,
      totalAmount: 0,
      discountAmount: 0,
      promotionError: req.promotionError,
      voucherCode: req.promotion ? req.promotion.code : undefined,
      data: [],
    });
  }

  if (userId) {
    //: GET USER ORDER
    const ordersByOrderCount = Array.from(
      new Set(orders[0].items.map((item) => item.orderCount))
    ).map((orderCount) => ({
      orderCount,
      totalQuantityOfOrderCount: orders[0].items
        .filter((item) => item.orderCount === orderCount)
        .reduce((acc, cur) => {
          return (acc += cur.quantity);
        }, 0),
      items: orders[0].items
        .filter((item) => item.orderCount === orderCount)
        .map((item) => ({
          ...item.toObject(),
          amount: item.price * item.quantity,
        })),
    }));

    const totalQuantity = orders[0].items.reduce((acc, cur) => {
      return (acc += cur.quantity);
    }, 0);
    const totalAmount = orders[0].amount;
    const finalTotal = req.promotion ? req.finalTotal : totalAmount;

    return res.status(200).json({
      status: "success",
      totalQuantity,
      totalAmount: finalTotal,
      discountAmount: totalAmount - finalTotal,
      promotionError: req.promotionError,
      voucherCode: req.promotion ? req.promotion.code : undefined,
      data: ordersByOrderCount,
    });
  } else {
    //: GET ALL ORDER
    const mergedItems = [];
    orders
      .flatMap((order) => order.items)
      .map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
        options: item.options,
        quantity: item.quantity,
        amount: item.price * item.quantity,
        status: item.status,
      }))
      .forEach((item) => {
        const existingItem = mergedItems.find(
          (mergedItem) =>
            mergedItem.name === item.name &&
            mergedItem.options === item.options &&
            mergedItem.status === item.status
        );

        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.amount += item.quantity * item.price;
        } else {
          mergedItems.push(item);
        }
      });

    const ordersByNumberOfMenuItem = mergedItems.map((item) => ({
      ...item,
      userOrders: orders
        .filter((order) => {
          const matchedItems = order.items.filter(
            (itemOfOrder) =>
              itemOfOrder.name === item.name &&
              itemOfOrder.options === item.options
          );

          return matchedItems.length > 0;
        })
        .map((order) => {
          const orderQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.quantity);
            }, 0);

          const loadingQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.loadingQuantity);
            }, 0);

          const finishedQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.finishedQuantity);
            }, 0);

          return {
            userId: order.userId._id,
            fullName: order.userId.fullName,
            img_avatar_url: order.userId.img_avatar_url,
            role: order.userId.role,
            orderQuantity,
            loadingQuantity,
            finishedQuantity,
          };
        }),
    }));
    const totalAmount = orders.reduce((acc, cur) => {
      return (acc += cur.amount);
    }, 0);
    const totalQuantity = ordersByNumberOfMenuItem.reduce((acc, cur) => {
      return (acc += cur.quantity);
    }, 0);
    const finalTotal = req.promotion ? req.finalTotal : totalAmount;

    return res.status(200).json({
      status: "success",
      totalQuantity,
      totalAmount: finalTotal,
      discountAmount: totalAmount - finalTotal,
      promotionError: req.promotionError,
      voucherCode: req.promotion ? req.promotion.code : undefined,
      data: ordersByNumberOfMenuItem,
    });
  }
});

exports.getOrdersForStaff = catchAsync(async (req, res, next) => {
  const { tableId } = req.query;

  let orders = await Order.find(
    { ...(tableId && { tableId }), paymentStatus: "unpaid" },
    {
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }
  ).populate({
    path: "userId",
    select: "fullName img_avatar_url role",
  });

  // if (orders.length === 0) {
  //   return res.status(200).json({
  //     status: "success",
  //     totalQuantity: 0,
  //     data: [],
  //   });
  // }

  // if (statusOrder === "loading") {
  //   const ordersByStatus = orders
  //     .flatMap((order) =>
  //       order.items
  //         .filter((item) => item.status === "loading")
  //         .map((item) => ({
  //           _id: item._id,
  //           menuItemId: item.menuItemId._id,
  //           name: item.menuItemId.name,
  //           options: item.options,
  //           price: item.menuItemId.price,
  //           image_url: item.menuItemId.image_url,
  //           quantity: item.quantity,
  //           amount: item.menuItemId.price * item.quantity,
  //           orderCount: item.orderCount,
  //           status: item.status,
  //           createdAt: item.createdAt,
  //           userOrder: order.userId,
  //         }))
  //     )
  //     .sort((a, b) => b.createdAt - a.createdAt);

  //   // a.createdAt - b.createdAt
  //   // b.createdAt - a.createdAt

  //   const totalQuantity = ordersByStatus.reduce((acc, cur) => {
  //     return (acc += cur.quantity);
  //   }, 0);

  //   return res.status(200).json({
  //     status: "success",
  //     totalQuantity,
  //     data: ordersByStatus,
  //   });
  // } else if (statusOrder === "finished") {
  //   //: GET ALL ORDER
  //   const mergedItems = [];
  //   orders
  //     .flatMap((order) => order.items)
  //     .map((item) => ({
  //       menuItemId: item.menuItemId._id,
  //       name: item.menuItemId.name,
  //       price: item.menuItemId.price,
  //       image_url: item.menuItemId.image_url,
  //       options: item.options,
  //       totalQuantity: item.quantity,
  //       amount: item.menuItemId.price * item.quantity,
  //       status: item.status,
  //     }))
  //     .forEach((item) => {
  //       const existingItem = mergedItems.find(
  //         (mergedItem) =>
  //           mergedItem.name === item.name && mergedItem.options === item.options
  //       );

  //       if (existingItem) {
  //         existingItem.totalQuantity += item.totalQuantity;
  //         existingItem.amount += item.price * item.totalQuantity;

  //         if (item.status === "finished") {
  //           existingItem.finishedQuantity += item.totalQuantity;
  //         } else if (item.status === "loading") {
  //           existingItem.loadingQuantity += item.totalQuantity;
  //         }
  //       } else {
  //         mergedItems.push({
  //           ...item,
  //           loadingQuantity: item.status === "loading" ? item.totalQuantity : 0,
  //           finishedQuantity:
  //             item.status === "finished" ? item.totalQuantity : 0,
  //         });
  //       }
  //     });

  //   const ordersByNumberOfMenuItem = mergedItems.map((item) => ({
  //     ...item,
  //     userOrders: orders
  //       .filter((order) => {
  //         // Filter items in the order to match the current item by name and options
  //         const matchedItems = order.items.filter(
  //           (itemOfOrder) =>
  //             itemOfOrder.menuItemId.name === item.name &&
  //             itemOfOrder.options === item.options
  //         );

  //         return matchedItems.length > 0;
  //       })
  //       .map((order) => {
  //         const finishedQuantity = order.items
  //           .filter(
  //             (itemOfOrder) =>
  //               itemOfOrder.menuItemId.name === item.name &&
  //               itemOfOrder.options === item.options &&
  //               itemOfOrder.status === "finished"
  //           )
  //           .reduce((accumulator, currentValue) => {
  //             return (accumulator += currentValue.quantity);
  //           }, 0);

  //         const loadingQuantity = order.items
  //           .filter(
  //             (itemOfOrder) =>
  //               itemOfOrder.menuItemId.name === item.name &&
  //               itemOfOrder.options === item.options &&
  //               itemOfOrder.status === "loading"
  //           )
  //           .reduce((accumulator, currentValue) => {
  //             return (accumulator += currentValue.quantity);
  //           }, 0);

  //         return {
  //           userId: order.userId._id,
  //           fullName: order.userId.fullName,
  //           img_avatar_url: order.userId.img_avatar_url,
  //           role: order.userId.role,
  //           finishedQuantity: finishedQuantity,
  //           loadingQuantity: loadingQuantity,
  //         };
  //       }),
  //   }));

  //   const totalAmount = ordersByNumberOfMenuItem.reduce((acc, cur) => {
  //     return (acc += cur.price * cur.totalQuantity);
  //   }, 0);
  //   const totalQuantity = ordersByNumberOfMenuItem.reduce((acc, cur) => {
  //     return (acc += cur.totalQuantity);
  //   }, 0);
  //   const finalTotal = req.promotion ? req.finalTotal : totalAmount;

  //   return res.status(200).json({
  //     status: "success",
  //     totalQuantity,
  //     totalAmount: finalTotal,
  //     discountAmount: totalAmount - finalTotal,
  //     promotionError: req.promotionError,
  //     voucherCode: req.promotion ? req.promotion.code : undefined,
  //     data: ordersByNumberOfMenuItem,
  //   });
  // }

  if (tableId) {
    //: GET ALL ORDER
    const mergedItems = [];
    orders
      .flatMap((order) => order.items)
      .map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
        options: item.options,
        quantity: item.quantity,
        loadingQuantity: item.loadingQuantity,
        finishedQuantity: item.finishedQuantity,
        amount: item.price * item.quantity,
      }))
      .forEach((item) => {
        const existingItem = mergedItems.find(
          (mergedItem) =>
            mergedItem.name === item.name && mergedItem.options === item.options
        );

        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.loadingQuantity += item.loadingQuantity;
          existingItem.finishedQuantity += item.finishedQuantity;
          existingItem.amount += item.quantity * item.price;
        } else {
          mergedItems.push(item);
        }
      });

    const ordersByNumberOfMenuItem = mergedItems.map((item) => ({
      ...item,
      userOrders: orders
        .filter((order) => {
          const matchedItems = order.items.filter(
            (itemOfOrder) =>
              itemOfOrder.name === item.name &&
              itemOfOrder.options === item.options
          );

          return matchedItems.length > 0;
        })
        .map((order) => {
          const orderQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.quantity);
            }, 0);

          const loadingQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.loadingQuantity);
            }, 0);

          const finishedQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.finishedQuantity);
            }, 0);

          return {
            userId: order.userId._id,
            fullName: order.userId.fullName,
            img_avatar_url: order.userId.img_avatar_url,
            role: order.userId.role,
            orderQuantity,
            loadingQuantity,
            finishedQuantity,
          };
        }),
    }));
    const totalAmount = orders.reduce((acc, cur) => {
      return (acc += cur.amount);
    }, 0);
    const totalQuantity = ordersByNumberOfMenuItem.reduce((acc, cur) => {
      return (acc += cur.quantity);
    }, 0);
    const finalTotal = req.promotion ? req.finalTotal : totalAmount;

    return res.status(200).json({
      status: "success",
      totalQuantity,
      totalAmount: finalTotal,
      discountAmount: totalAmount - finalTotal,
      promotionError: req.promotionError,
      voucherCode: req.promotion ? req.promotion.code : undefined,
      data: ordersByNumberOfMenuItem,
    });
  }

  const mergedOrders = {};

  orders.forEach((order) => {
    const items = order.items
      .map((item) => ({
        _id: item._id,
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
        options: item.options,
        quantity: item.quantity,
        loadingQuantity: item.loadingQuantity,
        finishedQuantity: item.finishedQuantity,
        status: item.status,
        amount: item.price * item.quantity,
        orderCount: item.orderCount,
        createdAt: item.createdAt,
        userOrder: {
          fullName: order.userId.fullName,
          img_avatar_url: order.userId.img_avatar_url,
          role: order.userId.role,
        },
      }))
      .filter((item) => item.status === "loading");

    if (!mergedOrders[order.tableNumber]) {
      mergedOrders[order.tableNumber] = {
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        items,
      };
    } else if (
      mergedOrders[order.tableNumber].tableNumber === order.tableNumber
    ) {
      mergedOrders[order.tableNumber].items.push(...items);
      mergedOrders[order.tableNumber].items.sort(
        (a, b) => b.createdAt - a.createdAt
      );
    }

    if (mergedOrders[order.tableNumber].items.length === 0) {
      delete mergedOrders[order.tableNumber];
    }
  });

  const listLoading = Object.values(mergedOrders);

  res.status(200).json({
    status: "success",
    data: listLoading,
  });
});

exports.createOrder = catchAsync(async (req, res, next) => {
  checkSpellFields(["items"], req.body);

  const userId = req.user._id;
  const { tableId } = req.params;
  const { items } = req.body;

  let amount = 0;

  // Gộp quantity các món client gửi theo menuItemId và options
  const mergedItems = [];
  items.forEach((item) => {
    const existingItem = mergedItems.find(
      (mergedItem) =>
        mergedItem.menuItemId === item.menuItemId &&
        mergedItem.options === item.options
    );

    if (existingItem) {
      existingItem.quantity += item.quantity;
    } else {
      mergedItems.push({ ...item });
    }
  });

  // Check hợp lệ id của menuItem
  const menuItemIds = Array.from(
    new Set(mergedItems.map((item) => item.menuItemId))
  );
  const menuItems = await MenuItem.find(
    { _id: { $in: menuItemIds } },
    { name: 1, price: 1, image_url: 1 }
  );

  if (menuItems.length !== menuItemIds.length) {
    return next(
      new AppError("One or more menu items are not on the menu", 404)
    );
  }

  // Lấy tableNumber
  const table = await Table.findById(tableId, { tableNumber: 1 });

  // Xử lý 2 trường hợp đã có đơn và chưa có đơn trong db orders
  let order = await Order.findOne({
    userId,
    tableId,
    paymentStatus: "unpaid",
  });

  if (order) {
    for (const mergedItem of mergedItems) {
      const menuItem = menuItems.find((mi) =>
        mi._id.equals(mergedItem.menuItemId)
      );

      mergedItem.name = menuItem.name;
      mergedItem.price = menuItem.price;
      mergedItem.image_url = menuItem.image_url;
      mergedItem.loadingQuantity = mergedItem.quantity;
      mergedItem.finishedQuantity = 0;
      mergedItem.orderCount =
        order.items[order.items.length - 1].orderCount + 1;
      amount += menuItem.price * mergedItem.quantity;
    }
    order.items.push(...mergedItems);
    order.amount += amount;
    order = await order.save();
  } else {
    for (const mergedItem of mergedItems) {
      const menuItem = menuItems.find((mi) =>
        mi._id.equals(mergedItem.menuItemId)
      );

      mergedItem.name = menuItem.name;
      mergedItem.price = menuItem.price;
      mergedItem.image_url = menuItem.image_url;
      mergedItem.loadingQuantity = mergedItem.quantity;
      mergedItem.finishedQuantity = 0;
      mergedItem.orderCount = 1;
      amount += menuItem.price * mergedItem.quantity;
    }

    order = await Order.create({
      userId,
      tableId,
      tableNumber: table.tableNumber,
      items: mergedItems,
      amount,
    });
  }

  res.status(201).json({
    status: "success",
    data: order,
  });
});

exports.updateStatusItem = catchAsync(async (req, res, next) => {
  const { tableId, itemId } = req.params;
  const { status, quantity } = req.query;

  const order = await Order.findOne({
    tableId,
    paymentStatus: "unpaid",
    items: {
      $elemMatch: {
        _id: itemId,
      },
    },
  });

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const item = order.items.find((item) => item._id.toString() === itemId);

  if (status === "finished" && quantity > item.loadingQuantity) {
    return next(
      new AppError("Quantity cannot be greater than loadingQuantity", 400)
    );
  } else if (status === "loading" && quantity > item.finishedQuantity) {
    return next(
      new AppError("Quantity cannot be greater than finishedQuantity", 400)
    );
  }

  let updatedOrderItems;
  if (status === "finished") {
    // Update loadingQuantity, finishedQuantity
    updatedOrderItems = await Order.findOneAndUpdate(
      {
        tableId,
        paymentStatus: "unpaid",
        items: {
          $elemMatch: {
            _id: itemId,
          },
        },
      },
      {
        $inc: {
          "items.$.loadingQuantity": -quantity,
          "items.$.finishedQuantity": quantity,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Check nếu loadingQuantity = 0 thì set status thành finished
    const item = updatedOrderItems.items.find(
      (item) => item._id.toString() === itemId
    );

    if (item.loadingQuantity === 0) {
      updatedOrderItems = await Order.findOneAndUpdate(
        {
          tableId,
          paymentStatus: "unpaid",
          items: {
            $elemMatch: {
              _id: itemId,
            },
          },
        },
        {
          $set: {
            "items.$.status": "finished",
          },
        },
        {
          new: true,
        }
      );
    }
  } else if (status === "loading") {
    updatedOrderItems = await Order.findOneAndUpdate(
      {
        tableId,
        paymentStatus: "unpaid",
        items: {
          $elemMatch: {
            _id: itemId,
          },
        },
      },
      {
        $inc: {
          "items.$.loadingQuantity": quantity,
          "items.$.finishedQuantity": -quantity,
        },

        "items.$.status": "loading",
      },
      {
        new: true,
        runValidators: true,
      }
    );
  }

  res.status(200).json({
    status: "success",
    data: updatedOrderItems,
  });
});

exports.deleteOrderItem = catchAsync(async (req, res, next) => {
  const specifiedTime = req.query.specifiedTime ? req.query.specifiedTime : 180;
  const timeAllowDelete = new Date(
    Date.now() - Number.parseInt(specifiedTime) * 1000
  );

  const { tableId, itemId } = req.params;
  const { quantity } = req.query;
  const user = req.user;

  let order = await Order.findOne({
    tableId,
    paymentStatus: "unpaid",
    items: {
      $elemMatch: {
        _id: itemId,
      },
    },
  });

  if (!order) {
    return next(new AppError("Không tìm thấy món", 404));
  }

  const item = order.items.find((item) => item._id.toString() === itemId);
  if (user.role === "client") {
    if (item.status === "finished") {
      return next(new AppError("Không thể xoá món này vì món đã hoàn thành"));
    }

    if (timeAllowDelete - item.createdAt >= 0) {
      return next(
        new AppError("Không thể xoá món này vì đã hết thời gian quy định", 400)
      );
    }
  } else {
    if (item.status === "finished") {
      return next(new AppError("Không thể xoá món này vì món đã hoàn thành"));
    }
  }

  if (quantity > item.loadingQuantity) {
    return next(
      new AppError("Quantity cannot be greater than loadingQuantity", 400)
    );
  }

  order = await Order.findOneAndUpdate(
    {
      tableId,
      paymentStatus: "unpaid",
      items: {
        $elemMatch: {
          _id: itemId,
        },
      },
    },
    {
      $inc: {
        "items.$.loadingQuantity": -quantity,
        "items.$.quantity": -quantity,
      },
    },
    {
      new: true,
    }
  );

  const itemAfterUpdated = order.items.find(
    (item) => item._id.toString() === itemId
  );

  // Check nếu quantity = 0 thì pull obj đó khỏi items
  if (itemAfterUpdated.quantity === 0) {
    await Order.findOneAndUpdate(
      {
        tableId,
        paymentStatus: "unpaid",
        items: {
          $elemMatch: {
            _id: itemId,
          },
        },
      },
      {
        $pull: { items: { _id: itemId } },
      }
    );
  }

  // Xoá mà loadingQuantity = 0 thì set status = finished
  if (itemAfterUpdated.loadingQuantity === 0) {
    await Order.findOneAndUpdate(
      {
        tableId,
        paymentStatus: "unpaid",
        items: {
          $elemMatch: {
            _id: itemId,
          },
        },
      },
      {
        $set: {
          "items.$.status": "finished",
        },
      }
    );
  }

  // Tính lại amount
  order = await Order.findById(order._id);
  if (order.items.length > 0) {
    order.amount = order.items.reduce((acc, cur) => {
      return (acc += cur.price * cur.quantity);
    }, 0);

    await order.save();
  } else if (order.items.length === 0) {
    // Check nếu items.length = 0 thì xoá order
    await Order.findByIdAndDelete(order._id);
  }

  res.status(200).json({
    status: "success",
    message: `Deleted successfully!!!`,
  });
});

// exports.updateDBOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find()
//     .populate({
//       path: "items.menuItemId",
//       select: "name price image_url",
//     })
//     .populate({
//       path: "tableId",
//       select: "tableNumber",
//     });

//   for (const order of orders) {
//     order.tableNumber = order.tableId.tableNumber;
//     for (const item of order.items) {
//       item.name = item.menuItemId.name;
//       item.price = item.menuItemId.price;
//       item.image_url = item.menuItemId.image_url;
//       item.loadingQuantity = 0;
//       item.finishedQuantity = item.quantity;
//     }

//     await order.save();
//   }

//   res.status(200).json({
//     status: "success",
//     message: "Updated successfully",
//   });
// });
