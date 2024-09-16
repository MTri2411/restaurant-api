const Order = require("../models/OrderModel");
const Payment = require("../models/PaymentModel");
const Table = require("../models/TableModel");
const Promotion = require("../models/PromotionsModel");
const PromotionUsed = require("../models/PromotionsUsedModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const axios = require("axios").default;
const CryptoJS = require("crypto-js");
const moment = require("moment");
const mongoose = require("mongoose");
const { sendNotification } = require("../firebase/initializeFirebase");

const config = {
  app_id: "2554",
  key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn",
  key2: "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf",
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
};

const validatePayment = async (req, res, next) => {
  const { tableId } = req.params;
  const userId = req.query.userId ? req.user._id : undefined;

  let orders = await Order.find(
    {
      tableId,
      ...(userId && { userId }),
      paymentStatus: "unpaid",
    },
    {
      "items.createdAt": 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }
  ).populate({
    path: "items.menuItemId",
    select: "name price",
  });

  if (orders.length === 0) {
    return next(new AppError("No order found", 404));
  }

  const seenNames = new Set();
  const loadingItems = orders
    .flatMap((order) =>
      order.items.filter((item) => {
        if (item.status === "loading" && !seenNames.has(item.name)) {
          seenNames.add(item.name);
          return true;
        }
      })
    )
    .map((item) => item.name);

  if (loadingItems.length > 0) {
    return next(
      new AppError(
        `Payment can not be made due to incomplete items: ${loadingItems.join(
          ", "
        )}`,
        400
      )
    );
  }

  return orders;
};

const getDateRange = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

exports.zaloPayment = catchAsync(async (req, res, next) => {
  const orders = await validatePayment(req, res, next);
  const { tableId } = req.params;

  let items = [];
  orders
    .flatMap((order) => order.items)
    .map((orderItem) => {
      const existingOrderItemByIndex = items.findIndex(
        (item) =>
          item.id === orderItem.menuItemId._id.toString() &&
          item.options === orderItem.options
      );

      if (existingOrderItemByIndex !== -1) {
        items[existingOrderItemByIndex].quantity += orderItem.quantity;
        items[existingOrderItemByIndex].amount +=
          orderItem.menuItemId.price * orderItem.quantity;
      } else {
        items.push({
          id: orderItem.menuItemId._id.toString(),
          name: orderItem.menuItemId.name,
          options: orderItem.options,
          price: orderItem.menuItemId.price,
          quantity: orderItem.quantity,
          amount: orderItem.menuItemId.price * orderItem.quantity,
        });
      }
    });

  // Tính tổng số tiền trước khi áp dụng mã giảm giá
  const totalAmount = items.reduce((acc, cur) => {
    return (acc += cur.amount);
  }, 0);

  const { promotion, finalTotal = totalAmount } = req;

  const amount = finalTotal;

  const orderId = orders.map((order) => order._id);
  const arrUserIdForNoti = orders.map((order) => order.userId);
  const embed_data = {
    orderId,
    tableId,
    arrUserIdForNoti,
    promotion: promotion
      ? { _id: promotion._id, code: promotion.code }
      : undefined,
    amountDiscount:
      totalAmount - amount !== 0 ? totalAmount - amount : undefined,
  };

  const callback_url = `${process.env.RESTAURANT_API_URL}v1/payments/zalopayment-callback`;
  const transID = Math.floor(Math.random() * 1000000);
  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format("YYMMDD")}${transID}`,
    app_user: req.user._id,
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: amount,
    description: `Payment for the order #${transID}`,
    callback_url,
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data =
    config.app_id +
    "|" +
    order.app_trans_id +
    "|" +
    order.app_user +
    "|" +
    order.amount +
    "|" +
    order.app_time +
    "|" +
    order.embed_data +
    "|" +
    order.item;
  order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  let formBody = [];
  for (let i in order) {
    var encodedKey = encodeURIComponent(i);
    var encodedValue = encodeURIComponent(order[i]);
    formBody.push(encodedKey + "=" + encodedValue);
  }
  formBody = formBody.join("&");

  const result = await axios.post(config.endpoint, formBody, {
    header: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  res.status(200).json(result.data);
});

// exports.zaloPaymentCallback = async (req, res, next) => {
//   let result = {};
//   const session = await mongoose.startSession();

//   try {
//     let dataStr = req.body.data;
//     let reqMac = req.body.mac;

//     let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

//     // kiểm tra callback hợp lệ (đến từ ZaloPay server)
//     if (reqMac !== mac) {
//       // callback không hợp lệ
//       result.return_code = -1;
//       result.return_message = "mac not equal";
//     } else {
//       session.startTransaction();
//       // thanh toán thành công
//       // merchant cập nhật trạng thái cho đơn hàng
//       let dataJson = JSON.parse(dataStr, config.key2);
//       const orderId = JSON.parse(dataJson.embed_data).orderId;
//       const tableId = JSON.parse(dataJson.embed_data).tableId;
//       const arrUserIdForNoti = JSON.parse(dataJson.embed_data).arrUserIdForNoti;
//       const promotion = JSON.parse(dataJson.embed_data).promotion;
//       const amountDiscount = JSON.parse(dataJson.embed_data).amountDiscount;

//       await Order.updateMany(
//         { _id: { $in: orderId } },
//         { paymentStatus: "paid" },
//         { session }
//       );
//       const payment = await Payment.create(
//         [
//           {
//             orderId: orderId,
//             userId: dataJson.app_user,
//             amount: dataJson.amount,
//             paymentMethod: "ZaloPay",
//             voucher: promotion?.code,
//             amountDiscount: amountDiscount,
//             appTransactionId: dataJson.app_trans_id,
//             zpTransactionId: dataJson.zp_trans_id,
//           },
//         ],
//         { session }
//       );

//       // await Promotion.findOneAndUpdate(
//       //   { code: promotion.code },
//       //   { $inc: { usedCount: 1 } }
//       //   // { session }
//       // );

//       // await User.findByIdAndUpdate(
//       //   dataJson.app_user,
//       //   {
//       //     $push: {
//       //       usedPromotions: {
//       //         promotion: promotion._id,
//       //         timesUsed: 1,
//       //       },
//       //     },
//       //   },
//       //  { session }
//       // );

//       const staffs = await User.find(
//         { role: "staff" },
//         { role: 1, FCMTokens: 1 }
//       );

//       let tokens = staffs
//         .map((staff) => staff.FCMTokens)
//         .filter((token) => token !== "");

//       for (const userId of arrUserIdForNoti) {
//         const user = await User.findOne({ _id: userId }, { FCMTokens: 1 });

//         if (user) {
//           tokens.push(user.FCMTokens);
//         }
//       }

//       const payload = {
//         title: "Thanh Toán ZaloPay Thành Công",
//         body: `Bàn ${tableNumber} đã thanh toán thành công`,
//         data: {
//           paymentId: payment[0]._id.toString(),
//           type: "afterPayment",
//         },
//         image_url:
//           "https://res.cloudinary.com/dexkjvage/image/upload/v1724397886/restaurant_image/paymentSuccess.jpg",
//       };

//       sendNotification(tokens, payload);

//       await session.commitTransaction();
//       session.endSession();

//       result.return_code = 1;
//       result.return_message = "success";
//     }
//   } catch (ex) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error processing ZaloPay callback:", ex);

//     result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
//     result.return_message = ex.message;
//   }

//   // thông báo kết quả cho ZaloPay server
//   res.json(result);
// };

exports.zaloPaymentCallback = async (req, res, next) => {
  let result = {};

  let dataStr = req.body.data;
  let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

  let reqMac = req.body.mac;

  // Kiểm tra callback hợp lệ (đến từ ZaloPay server)
  if (reqMac !== mac) {
    // callback không hợp lệ
    result.return_code = -1;
    result.return_message = "mac not equal";

    return res.json(result);
  }

  // Thanh toán thành công
  // Merchant cập nhật trạng thái cho đơn hàng
  let dataJson = JSON.parse(dataStr, config.key2);
  const embed_data = JSON.parse(dataJson.embed_data);
  const orderId = embed_data.orderId;
  const tableId = embed_data.tableId;
  const arrUserIdForNoti = embed_data.arrUserIdForNoti;
  const promotion = embed_data.promotion;
  const amountDiscount = embed_data.amountDiscount;

  // Push FCMTokens vào array tokens và query table (lấy tableNumber và currentStaffs)
  const table = await Table.findById(tableId, {
    tableNumber: 1,
    currentStaffs: 1,
  });

  let userName;
  let tokens = [];

  for (const staffId of table.currentStaffs) {
    const staff = await User.findOne(
      { _id: staffId },
      { fullName: 1, FCMTokens: 1 }
    );

    if (staff) {
      tokens.push(staff.FCMTokens);
    }
  }

  for (const userId of arrUserIdForNoti) {
    const user = await User.findOne(
      { _id: userId },
      { fullName: 1, FCMTokens: 1 }
    );

    if (arrUserIdForNoti.length === 1) {
      userName = user.fullName;
    }

    if (user) {
      tokens.push(user.FCMTokens);
    }
  }

  // Start Transaction
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await Order.updateMany(
      { _id: { $in: orderId } },
      { paymentStatus: "paid" },
      { session }
    );

    const payment = await Payment.create(
      [
        {
          orderId: orderId,
          userId: dataJson.app_user,
          amount: dataJson.amount,
          paymentMethod: "ZaloPay",
          voucher: promotion?.code,
          amountDiscount: amountDiscount,
          appTransactionId: dataJson.app_trans_id,
          zpTransactionId: dataJson.zp_trans_id,
        },
      ],
      { session }
    );

    const paymentId = payment[0]._id;

    if (promotion) {
      await Promotion.findOneAndUpdate(
        { code: promotion.code },
        { $inc: { usedCount: 1 } }
      );

      await PromotionUsed.create(
        [
          {
            userId: dataJson.app_user,
            promotionId: promotion._id,
            paymentId: paymentId,
            usageCount: 1,
            version: promotion.version,
          },
        ],
        { session }
      );

      const user = await User.findById(dataJson.app_user).select(
        "promotionsRedeemed"
      );

      const promotionIndex = user.promotionsRedeemed.findIndex(
        (redeemedPromotion) =>
          redeemedPromotion.promotionCode === promotion.code
      );

      if (promotionIndex !== -1) {
        if (user.promotionsRedeemed[promotionIndex].usageCount === 1) {
          user.promotionsRedeemed.splice(promotionIndex, 1);
        } else {
          user.promotionsRedeemed[promotionIndex].usageCount -= 1;
        }

        await user.save({ session });
      }
    }
    await session.commitTransaction();
    session.endSession();

    const body =
      arrUserIdForNoti.length === 1
        ? `Khách hàng ${userName}, bàn ${table.tableNumber} đã thanh toán thành công`
        : `Tổng đơn bàn ${table.tableNumber} đã thanh toán thành công`;
    const payload = {
      title: "Thanh Toán ZaloPay Thành Công",
      body,
      data: {
        paymentId: payment[0]._id.toString(),
        type: "afterPayment",
      },
      image_url:
        "https://res.cloudinary.com/dexkjvage/image/upload/v1724397886/restaurant_image/paymentSuccess.jpg",
    };

    sendNotification(tokens, payload);

    result.return_code = 1;
    result.return_message = "success";
  } catch (ex) {
    await session.abortTransaction();
    session.endSession();

    const body =
      arrUserIdForNoti.length === 1
        ? `Khách hàng ${userName}, bàn ${table.tableNumber} thanh toán không thành công`
        : `Tổng đơn bàn ${table.tableNumber} thanh toán không thành công`;
    const payload = {
      title: "Thanh Toán ZaloPay Không Thành Công",
      body,
      data: {
        type: "afterPayment",
      },
      image_url:
        "https://res.cloudinary.com/dexkjvage/image/upload/v1724397886/restaurant_image/paymentFail.jpg",
    };

    sendNotification(tokens, payload);
    console.error("Error processing ZaloPay callback:", ex);

    result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  // Thông báo kết quả cho ZaloPay server
  res.json(result);
};

exports.cashPayment = catchAsync(async (req, res, next) => {
  const orders = await validatePayment(req, res, next);
  const { tableId } = req.params;
  const { paymentMethod, userIdCash } = req.body;
  const staff = req.user;

  let tokens = [staff.FCMTokens];
  const tableInUse = await Table.findOne(
    { _id: tableId },
    { tableNumber: 1, currentUsers: 1 }
  );

  for (const userId of tableInUse.currentUsers) {
    const user = await User.findOne({ _id: userId }, { FCMTokens: 1 });

    if (user) {
      tokens.push(user.FCMTokens);
    }
  }

  const totalAmount = orders
    .flatMap((order) => order.items)
    .reduce((acc, cur) => {
      return (acc += cur.menuItemId.price * cur.quantity);
    }, 0);

  const { promotion, finalTotal = totalAmount } = req;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const orderIds = orders.map((order) => order._id);
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { paymentStatus: "paid" },
      { session }
    );

    const payment = await Payment.create(
      [
        {
          orderId: orderIds,
          userId: req.user._id,
          amount: finalTotal,
          voucher: promotion ? promotion.code : undefined,
          amountDiscount:
            totalAmount - finalTotal === 0
              ? undefined
              : totalAmount - finalTotal,
          paymentMethod: paymentMethod,
          appTransactionId: `${moment().format("YYMMDD")}${Math.floor(
            Math.random() * 1000000
          )}`,
        },
      ],
      { session }
    );

    const paymentId = payment[0]._id;

    if (promotion) {
      await Promotion.findOneAndUpdate(
        { code: promotion.code },
        { $inc: { usedCount: 1 } }
      );

      await PromotionUsed.create(
        [
          {
            userId: req.user._id,
            promotionId: promotion._id,
            paymentId: paymentId,
            usageCount: 1,
            version: promotion.version,
          },
        ],
        { session }
      );

      const user = await User.findById(req.user._id).select(
        "promotionsRedeemed"
      );

      const promotionIndex = user.promotionsRedeemed.findIndex(
        (redeemedPromotion) =>
          redeemedPromotion.promotionCode === promotion.code
      );

      if (promotionIndex !== -1) {
        if (user.promotionsRedeemed[promotionIndex].usageCount === 1) {
          user.promotionsRedeemed.splice(promotionIndex, 1);
        } else {
          user.promotionsRedeemed[promotionIndex].usageCount -= 1;
        }

        await user.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const payload = {
      title: "Thanh Toán Thành Công",
      body: `Bàn ${tableInUse.tableNumber} đã thanh toán thành công`,
      data: {
        paymentId: payment[0]._id.toString(),
        type: "afterPayment",
      },
      image_url:
        "https://res.cloudinary.com/dexkjvage/image/upload/v1724397886/restaurant_image/paymentSuccess.jpg",
    };

    sendNotification(tokens, payload);

    res.status(200).json({
      status: "success",
      data: payment,
      promotionError: req.promotionError,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const payload = {
      title: "Thanh Toán Không Thành Công",
      body: `Bàn ${tableInUse.tableNumber} thanh toán không thành công`,
      data: {
        type: "afterPayment",
      },
      image_url:
        "https://res.cloudinary.com/dexkjvage/image/upload/v1724397886/restaurant_image/paymentFail.jpg",
    };

    sendNotification(tokens, payload);
    console.log(error);
    return next(new AppError("Failed to process payment", 500));
  }
});

exports.sendNotificationBeforeZaloPayment = catchAsync(
  async (req, res, next) => {
    const { tableId } = req.params;

    const table = await Table.findById(tableId, {
      tableNumber: 1,
      paymentStatus: 1,
    });

    if (table.paymentStatus === "open") {
      return next();
    }

    const staffs = await User.find(
      { role: "staff" },
      { role: 1, FCMTokens: 1 }
    );
    const tokens = staffs
      .map((staff) => staff.FCMTokens)
      .filter((token) => token !== "");

    const payload = {
      title: "Thông Báo Thanh Toán",
      body: `Bàn ${table.tableNumber}`,
      data: {
        tableId,
        tableNumber: table.tableNumber.toString(),
        type: "beforePayment",
      },
    };

    sendNotification(tokens, payload);

    res.status(200).json({
      status: "success",
      message:
        "Yêu cầu thanh toán của bạn đã được gửi đến phục vụ. Vui lòng chờ trong ít phút.",
    });
  }
);

exports.sendNotificationBeforePayment = catchAsync(async (req, res, next) => {
  const { tableNumber, voucher, tableId, userIdCash } = req.body;

  const staffs = await User.find({ role: "staff" }, { role: 1, FCMTokens: 1 });
  const tokens = staffs
    .map((staff) => staff.FCMTokens)
    .filter((token) => token !== "");

  const payload = {
    title: "Thông Báo Thanh Toán",
    body: `Bàn ${tableNumber}`,
    data: {
      tableId: tableId.toString(),
      tableNumber: tableNumber.toString(),
      userIdCash: userIdCash.toString(),
      voucher,
      type: "beforePayment",
    },
  };

  sendNotification(tokens, payload);

  res.status(200).json({
    status: "success",
  });
});

exports.getPaymentsHistory = catchAsync(async (req, res, next) => {
  let user = req.user;
  let userIdQuery = req.query.userId;
  let userId = userIdQuery === undefined ? undefined : userIdQuery;

  let daysAgo = req.query.daysAgo || 30;
  let dateRange = getDateRange(daysAgo);

  let payments = await Payment.find(
    { ...(userId && { userId }), createdAt: { $gte: dateRange } },
    { updatedAt: 0, __v: 0 }
  )
    .populate({
      path: "orderId",
      select: "userId",
      populate: {
        path: "userId",
        select: "fullName img_avatar_url role",
      },
    })
    .populate({
      path: "orderId",
      select: "tableId",
      populate: {
        path: "tableId",
        select: "tableNumber",
      },
    })
    .populate({
      path: "orderId",
      select: "items",
      populate: {
        path: "items.menuItemId",
        select: "name engName price image_url rating",
      },
    })
    .populate({
      path: "userId",
      select: "fullName img_avatar_url role",
    })
    .sort({ createdAt: "desc" });

  if (user.role === "client") {
    payments = payments
      .map((eachPayment) => {
        const findOrderHaveUser = eachPayment.orderId.find(
          (order) => order.userId._id.toString() === user._id.toString()
        );

        if (findOrderHaveUser) {
          return eachPayment;
        }

        return null;
      })
      .filter((payment) => payment !== null);
  }

  const transformedData = payments.map((eachPayment) => {
    const items = eachPayment.orderId.flatMap((order) =>
      order.items.map((item) => ({
        menuItemId: item.menuItemId._id,
        name: item.menuItemId.name,
        engName: item.menuItemId.engName,
        price: item.menuItemId.price,
        image_url: item.menuItemId.image_url,
        rating: item.menuItemId.rating,
        quantity: item.quantity,
        amount: item.menuItemId.price * item.quantity,
        options: item.options,
        userOrder: {
          fullName: order.userId.fullName,
          img_avatar_url: order.userId.img_avatar_url,
          role: order.userId.role,
        },
      }))
    );

    const tableNumber = eachPayment.orderId[0].tableId.tableNumber;
    const userPay = {
      fullName: eachPayment.userId.fullName,
      img_avatar_url: eachPayment.userId.img_avatar_url,
      role: eachPayment.userId.role,
    };
    const userOrder = eachPayment.orderId.flatMap((order) => {
      return {
        fullName: order.userId.fullName,
        img_avatar_url: order.userId.img_avatar_url,
        role: order.userId.role,
      };
    });

    const transform = {
      ...eachPayment.toObject(),
      voucher: eachPayment.voucher,
      tableNumber,
      userPay,
      userOrder,
      items,
      orderId: eachPayment.orderId.map((order) => order._id),
    };

    delete transform.userId;
    return transform;
  });

  return res.status(200).json({
    status: "success",
    totalData: transformedData.length,
    data: transformedData,
  });
});

exports.getPaymentsHistoryDetail = catchAsync(async (req, res, next) => {
  const paymentId = req.params.id;
  const userId = req.user._id;
  const payment = await Payment.findById(paymentId, {
    updatedAt: 0,
    __v: 0,
  })
    .populate({
      path: "orderId",
      select: "userId tableId items",
      populate: [
        {
          path: "userId",
          select: "fullName img_avatar_url role",
        },
        {
          path: "tableId",
          select: "tableNumber",
        },
        {
          path: "items.menuItemId",
          select: "name engName price image_url rating",
        },
      ],
    })
    .populate({
      path: "userId",
      select: "fullName img_avatar_url role",
    });

  if (!payment) {
    return res.status(404).json({
      status: "error",
      message: "Không tìm thấy thanh toán",
    });
  }

  if (req.user.role === "client") {
    if (payment.userId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền truy cập thanh toán này",
      });
    }
  }

  const items =
    payment.orderId?.flatMap((order) =>
      order.items.map((item) => ({
        menuItemId: item.menuItemId._id,
        name: item.menuItemId.name,
        engName: item.menuItemId.engName,
        price: item.menuItemId.price,
        image_url: item.menuItemId.image_url,
        rating: item.menuItemId.rating,
        quantity: item.quantity,
        amount: item.menuItemId.price * item.quantity,
        options: item.options,
      }))
    ) || [];

  const tableNumber = payment.orderId?.[0]?.tableId?.tableNumber || null;

  const userPay = payment.userId
    ? {
        fullName: payment.userId.fullName,
        img_avatar_url: payment.userId.img_avatar_url,
        role: payment.userId.role,
      }
    : null;

  const userOrder =
    payment.orderId?.flatMap((order) => ({
      fullName: order.userId.fullName,
      img_avatar_url: order.userId.img_avatar_url,
      role: order.userId.role,
    })) || [];

  const transform = {
    ...payment.toObject(),
    voucher: payment.voucher,
    tableNumber,
    userPay,
    userOrder,
    items,
    orderId: payment.orderId?.map((order) => order._id) || [],
  };

  delete transform.userId;

  return res.status(200).json({
    status: "success",
    data: transform,
  });
});
