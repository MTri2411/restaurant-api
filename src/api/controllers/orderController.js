const Order = require("../models/OrderModel");
const MenuItem = require("../models/MenuItemModel");
const User = require("../models/UserModel");
const Table = require("../models/TableModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");

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
    return next(new AppError("User not found at the table", 404));
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
  )
    .populate({
      path: "items.menuItemId",
      select: "name price image_url",
    })
    .populate({
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
          amount: item.menuItemId.price * item.quantity,
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
        menuItemId: item.menuItemId._id,
        name: item.menuItemId.name,
        price: item.menuItemId.price,
        image_url: item.menuItemId.image_url,
        options: item.options,
        quantity: item.quantity,
        amount: item.menuItemId.price * item.quantity,
      }))
      .forEach((item) => {
        const existingItem = mergedItems.find(
          (mergedItem) =>
            mergedItem.name === item.name && mergedItem.options === item.options
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
          // Filter items in the order to match the current item by name and options
          const matchedItems = order.items.filter(
            (itemOfOrder) =>
              itemOfOrder.menuItemId.name === item.name &&
              itemOfOrder.options === item.options
          );

          return matchedItems.length > 0;
        })
        .map((order) => {
          // Find the matching item again to get the quantity
          const orderQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.menuItemId.name === item.name &&
                itemOfOrder.options === item.options
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.quantity);
            }, 0);

          return {
            userId: order.userId._id,
            fullName: order.userId.fullName,
            img_avatar_url: order.userId.img_avatar_url,
            role: order.userId.role,
            orderQuantity: orderQuantity,
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
  const { tableId } = req.params;
  const statusOrder = req.query.statusOrder;

  const orders = await Order.find(
    { tableId, paymentStatus: "unpaid" },
    {
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }
  )
    .populate({
      path: "items.menuItemId",
      select: "name price image_url",
    })
    .populate({
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

  if (statusOrder === "loading") {
    const ordersByStatus = orders
      .flatMap((order) =>
        order.items
          .filter((item) => item.status === "loading")
          .map((item) => ({
            _id: item._id,
            menuItemId: item.menuItemId._id,
            name: item.menuItemId.name,
            options: item.options,
            price: item.menuItemId.price,
            image_url: item.menuItemId.image_url,
            quantity: item.quantity,
            amount: item.menuItemId.price * item.quantity,
            orderCount: item.orderCount,
            status: item.status,
            createdAt: item.createdAt,
            userOrder: order.userId,
          }))
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    // a.createdAt - b.createdAt
    // b.createdAt - a.createdAt

    const totalQuantity = ordersByStatus.reduce((acc, cur) => {
      return (acc += cur.quantity);
    }, 0);

    return res.status(200).json({
      status: "success",
      totalQuantity,
      data: ordersByStatus,
    });
  } else if (statusOrder === "finished") {
    //: GET ALL ORDER
    const mergedItems = [];
    orders
      .flatMap((order) => order.items)
      .map((item) => ({
        menuItemId: item.menuItemId._id,
        name: item.menuItemId.name,
        price: item.menuItemId.price,
        image_url: item.menuItemId.image_url,
        options: item.options,
        totalQuantity: item.quantity,
        amount: item.menuItemId.price * item.quantity,
        status: item.status,
      }))
      .forEach((item) => {
        const existingItem = mergedItems.find(
          (mergedItem) =>
            mergedItem.name === item.name && mergedItem.options === item.options
        );

        if (existingItem) {
          existingItem.totalQuantity += item.totalQuantity;
          existingItem.amount += item.price * item.totalQuantity;

          if (item.status === "finished") {
            existingItem.finishedQuantity += item.totalQuantity;
          } else if (item.status === "loading") {
            existingItem.loadingQuantity += item.totalQuantity;
          }
        } else {
          mergedItems.push({
            ...item,
            loadingQuantity: item.status === "loading" ? item.totalQuantity : 0,
            finishedQuantity:
              item.status === "finished" ? item.totalQuantity : 0,
          });
        }
      });

    const ordersByNumberOfMenuItem = mergedItems.map((item) => ({
      ...item,
      userOrders: orders
        .filter((order) => {
          // Filter items in the order to match the current item by name and options
          const matchedItems = order.items.filter(
            (itemOfOrder) =>
              itemOfOrder.menuItemId.name === item.name &&
              itemOfOrder.options === item.options
          );

          return matchedItems.length > 0;
        })
        .map((order) => {
          const finishedQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.menuItemId.name === item.name &&
                itemOfOrder.options === item.options &&
                itemOfOrder.status === "finished"
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.quantity);
            }, 0);

          const loadingQuantity = order.items
            .filter(
              (itemOfOrder) =>
                itemOfOrder.menuItemId.name === item.name &&
                itemOfOrder.options === item.options &&
                itemOfOrder.status === "loading"
            )
            .reduce((accumulator, currentValue) => {
              return (accumulator += currentValue.quantity);
            }, 0);

          return {
            userId: order.userId._id,
            fullName: order.userId.fullName,
            img_avatar_url: order.userId.img_avatar_url,
            role: order.userId.role,
            finishedQuantity: finishedQuantity,
            loadingQuantity: loadingQuantity,
          };
        }),
    }));

    const totalAmount = ordersByNumberOfMenuItem.reduce((acc, cur) => {
      return (acc += cur.price * cur.totalQuantity);
    }, 0);
    const totalQuantity = ordersByNumberOfMenuItem.reduce((acc, cur) => {
      return (acc += cur.totalQuantity);
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
  } else {
    return res.status(200).json({
      status: "success",
      message: "Thiếu statusOrder",
    });
  }
});

exports.createOrder = catchAsync(async (req, res, next) => {
  checkSpellFields(["items"], req.body);

  const userId = req.user._id;
  const { tableId } = req.params;
  const { items } = req.body;

  let amount = 0;
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

  // Fetch all necessary menu items in a single query
  const menuItemIds = Array.from(
    new Set(mergedItems.map((item) => item.menuItemId))
  );
  const menuItems = await MenuItem.find(
    { _id: { $in: menuItemIds } },
    { price: 1 }
  );

  if (menuItems.length !== menuItemIds.length) {
    return next(
      new AppError("One or more menu items are not on the menu", 404)
    );
  }

  // Find the existing order
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

      mergedItem.orderCount = 1;
      amount += menuItem.price * mergedItem.quantity;
    }

    order = await Order.create({
      userId,
      tableId,
      items: mergedItems,
      amount,
    });
  }

  const populatedOrder = await order.populate({
    path: "items.menuItemId",
    select: "name engName price image_url rating",
  });

  res.status(201).json({
    status: "success",
    data: populatedOrder,
  });
});

exports.updateStatusItem = catchAsync(async (req, res, next) => {
  const { tableId, itemId } = req.params;
  const { status } = req.query;

  const updatedOrderItems = await Order.findOneAndUpdate(
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
      "items.$.status": status,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedOrderItems) {
    return next(new AppError("Item not found", 404));
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
  const user = req.user;

  const order = await Order.findOne({
    tableId,
    paymentStatus: "unpaid",
    items: {
      $elemMatch: {
        _id: itemId,
      },
    },
  }).populate({
    path: "items.menuItemId",
    select: "price",
  });

  if (!order) {
    return next(new AppError("Không tìm thấy món", 404));
  }

  const item = order.items.filter((item) => item._id.toString() === itemId);
  if (user.role === "client") {
    if (item[0].status === "finished") {
      return next(new AppError("Không thể xoá món này vì món đã hoàn thành"));
    }

    if (timeAllowDelete - item[0].createdAt >= 0) {
      return next(
        new AppError("Không thể xoá món này vì đã hết thời gian quy định", 400)
      );
    }
  } else {
    if (item[0].status === "finished") {
      return next(new AppError("Không thể xoá món này vì món đã hoàn thành"));
    }
  }

  order.items.pull({ _id: item[0]._id });
  if (order.items.length > 0) {
    order.amount = order.items.reduce((acc, cur) => {
      return (acc += cur.menuItemId.price * cur.quantity);
    }, 0);

    await order.save();
  } else if (order.items.length === 0) {
    await Order.findByIdAndDelete(order._id);
  }

  res.status(200).json({
    status: "success",
    message: `Deleted successfully!!!`,
  });
});
