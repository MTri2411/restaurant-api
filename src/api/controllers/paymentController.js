const Order = require("../models/OrderModel");
const Payment = require("../models/PaymentModel");
const Promotion = require("../models/PromotionsModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const axios = require("axios").default;
const CryptoJS = require("crypto-js");
const moment = require("moment");
const mongoose = require("mongoose");
const { options } = require("../routes/orderRoutes");

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
        if (item.status === "loading" && !seenNames.has(item.menuItemId.name)) {
          seenNames.add(item.menuItemId.name);
          return true;
        }
      })
    )
    .map((item) => item.menuItemId.name);

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

exports.zaloPayment = catchAsync(async (req, res, next) => {
  const orders = await validatePayment(req, res, next);
  const userId = req.user._id;

  if (orders.length === 0) {
    return next(new AppError("No order found", 404));
  }

  let items = [];
  orders.flatMap((order) => {
    return order.items.flatMap((orderItem) => {
      const existingOrderItemInItemsIndex = items.findIndex(
        (item) => item.id === orderItem.menuItemId._id.toString()
      );

      if (existingOrderItemInItemsIndex !== -1) {
        items[existingOrderItemInItemsIndex].quantity += orderItem.quantity;
      } else {
        items.push({
          id: orderItem.menuItemId._id.toString(),
          name: orderItem.menuItemId.name,
          quantity: orderItem.quantity,
          price: orderItem.menuItemId.price,
        });
      }
    });
  });

  const amount = items.reduce(
    (accumulator, currentValue) =>
      accumulator + currentValue.quantity * currentValue.price,
    0
  );

  const orderId = orders.map((order) => order._id);
  const embed_data = { orderId };
  const transID = Math.floor(Math.random() * 1000000);
  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format("YYMMDD")}${transID}`,
    app_user: userId,
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: amount,
    description: `Payment for the order #${transID}`,
    callback_url:
      "https://pro2052-restaurant-api.onrender.com/v1/payments/zalopayment-callback",
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

exports.zaloPaymentCallback = async (req, res, next) => {
  let result = {};
  const session = await mongoose.startSession();

  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (reqMac !== mac) {
      // callback không hợp lệ
      result.return_code = -1;
      result.return_message = "mac not equal";
    } else {
      session.startTransaction();
      // thanh toán thành công
      // merchant cập nhật trạng thái cho đơn hàng
      let dataJson = JSON.parse(dataStr, config.key2);
      const orderId = JSON.parse(dataJson.embed_data).orderId;

      await Order.updateMany(
        { _id: { $in: orderId } },
        { paymentStatus: "paid" },
        { session }
      );

      await Payment.create({
        orderId: orderId,
        userId: dataJson.app_user,
        amount: dataJson.amount,
        paymentMethod: "ZaloPay",
        appTransactionId: dataJson.app_trans_id,
        zpTransactionId: dataJson.zp_trans_id,
      });

      await session.commitTransaction();
      session.endSession();

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error processing ZaloPay callback:", ex);

    result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  // thông báo kết quả cho ZaloPay server
  res.json(result);
};

exports.cashPayment = catchAsync(async (req, res, next) => {
  const orders = await validatePayment(req, res, next);

  const totalAmount = orders.reduce((accumulator, order) => {
    return (
      accumulator +
      order.items.reduce((subtotal, item) => {
        return subtotal + item.menuItemId.price * item.quantity;
      }, 0)
    );
  }, 0);

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const orderIds = orders.map((order) => order._id);
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { paymentStatus: "paid" },
      { session }
    );

    const payment = await Payment.create({
      orderId: orderIds,
      userId: req.user._id,
      amount: totalAmount,
      paymentMethod: "Cash",
      appTransactionId: `${moment().format("YYMMDD")}${Math.floor(
        Math.random() * 1000000
      )}`,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    return next(new AppError("Failed to process payment", 500));
  }
});

exports.getPaymentsHistory = catchAsync(async (req, res, next) => {
  let userId = req.user._id;
  let userIdQuery = req.query.userId;
  const user = await User.findOne({ _id: userId }, { role: 1 });
  if (user.role !== "client") {
    userId = userIdQuery === undefined ? undefined : userIdQuery;
  }

  const payments = await Payment.find(
    { ...(userId && { userId }) },
    { updatedAt: 0, __v: 0 }
  )
    .populate({
      path: "orderId",
      select: "userId",
      populate: {
        path: "userId",
        select: "fullName img_avatar_url",
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
      select: "fullName img_avatar_url",
    })
    .sort({ createdAt: "desc" });

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
        note: item.note,
        options: item.options,
      }))
    );
    const tableNumber = eachPayment.orderId[0].tableId.tableNumber;
    const userPay = {
      fullName: eachPayment.userId.fullName,
      img_avatar_url: eachPayment.userId.img_avatar_url,
    };
    const userOrder = eachPayment.orderId.flatMap((order) => {
      return {
        fullName: order.userId.fullName,
        img_avatar_url: order.userId.img_avatar_url,
      };
    });

    const transform = {
      ...eachPayment.toObject(),
      tableNumber,
      userPay,
      userOrder,
      items,
    };

    delete transform.orderId;
    delete transform.userId;
    return transform;
  });

  return res.status(200).json({
    status: "success",
    totalData: transformedData.length,
    data: transformedData,
  });
});
