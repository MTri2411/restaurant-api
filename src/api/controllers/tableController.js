const Table = require("../models/TableModel");
const Order = require("../models/OrderModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const QRCode = require("qrcode");
const path = require("path");

exports.createQRcode = catchAsync(async (req, res, next) => {

  const dataInQRCode = JSON.stringify({
    tableId: "66ab3a805c6a6d8a1d7f8a8d",
    type: "hardQRCode",
  });

  // Generate QRCode for table
  await QRCode.toFile(
    path.join(__dirname, `../public/img/qrCodeBan11.png`),
    dataInQRCode,
    {
      width: 800,
    }
  );

  res.status(200).json({
    status: "success",
  });
});

exports.scanQRCode = catchAsync(async (req, res, next) => {
  const projection = {
    qrCode: 0,
    isDelete: 0,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  const { tableId } = req.params;
  const { type } = req.query;
  const userId = req.user ? req.user._id : undefined;

  if (!userId) {
    return res.status(200).json({
      status: "success",
      usageAllowed: "yes",
    });
  }

  const [currentUser, table] = await Promise.all([
    Table.findOne({ currentUsers: userId }, projection),
    Table.findById(tableId, projection),
  ]);

  if (!currentUser) {
    if (type === "hardQRCode") {
      if (table.status === "lock") {
        return res.status(200).json({
          status: "success",
          usageAllowed: "no",
          message: `Bàn đang khoá`,
          data: table,
        });
      } else {
        if (table.currentUsers.length === 0) {
          table.currentUsers.push(userId);
          await table.save();
          return res.status(200).json({
            status: "success",
            usageAllowed: "yes",
            data: table,
          });
        } else if (table.currentUsers.length > 0) {
          return res.status(200).json({
            status: "success",
            usageAllowed: "no",
            message: `Bàn đang có khách`,
            data: table,
          });
        }
      }
    } else if (type === "softQRCode") {
      table.currentUsers.push(userId);
      await table.save();
      return res.status(200).json({
        status: "success",
        usageAllowed: "yes",
        data: table,
      });
    } else {
      return res.status(200).json({
        status: "success",
        usageAllowed: "no",
        message: `Sai type QR Code`,
      });
    }
  } else {
    if (currentUser.tableNumber === table.tableNumber) {
      return res.status(200).json({
        status: "success",
        usageAllowed: "yes",
        data: table,
      });
    } else {
      return res.status(200).json({
        status: "success",
        usageAllowed: "no",
        message: `Bạn đang ở bàn số ${currentUser.tableNumber}`,
        data: table,
      });
    }
  }
});

exports.getTableNumberInUse = catchAsync(async (req, res, next) => {
  const projection = {
    qrCode: 0,
    isDelete: 0,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  const userId = req.user._id;

  const tableNumberInUse = await Table.findOne(
    { currentUsers: userId },
    projection
  );

  res.status(200).json({
    status: "success",
    data: {
      tableNumberInUse:
        tableNumberInUse === null ? null : tableNumberInUse.tableNumber,
    },
  });
});

exports.getAllUserUseTable = catchAsync(async (req, res, next) => {
  const projection = {
    qrCode: 0,
    isDelete: 0,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  const { tableId } = req.params;

  const table = await Table.findById(tableId, projection).populate({
    path: "currentUsers",
    select: "fullName img_avatar_url",
  });

  res.status(200).json({
    status: "success",
    totalUser: table.currentUsers.length,
    data: table.currentUsers,
  });
});

exports.logOutTable = catchAsync(async (req, res, next) => {
  const userId = req.body.userId ? req.body.userId : req.user._id;

  const order = await Order.findOne({
    userId,
    paymentStatus: "unpaid",
  });

  if (order) {
    return next(
      new AppError("Vui lòng thanh toán đơn hàng trước khi rời khỏi bàn", 400)
    );
  }

  await Table.updateOne(
    { currentUsers: userId },
    { $pull: { currentUsers: userId } }
  );

  res.status(200).json({
    status: "success",
    message: "Log out table successfully!!!",
  });
});

exports.createSoftQRCode = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) return next(new AppError("Table not found", 404));

  const dataInQRCode = JSON.stringify({ tableId, type: "softQRCode" });

  // Generate QRCode for table
  const softQRCode = await QRCode.toDataURL(dataInQRCode);

  res.status(200).json({
    status: "success",
    data: softQRCode,
  });
});

exports.getTables = catchAsync(async (req, res, next) => {
  const user = req.user;

  let projection;

  if (user.role === "staff") {
    projection = {
      qrCode: 0,
      isDelete: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    };
  } else if (user.role === "admin") {
    projection = {
      currentUsers: 0,
      isDelete: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    };
  }

  // Get tables
  const tables = await Table.find({ isDelete: false }, projection);

  // Check if no tables found
  if (tables.length === 0) return next(new AppError("No tables found", 404));

  res.status(200).json({
    success: "success",
    totalTables: tables.length,
    data: tables,
  });
});

exports.createTable = catchAsync(async (req, res, next) => {
  checkSpellFields(["tableNumber"], req.body);

  const { tableNumber } = req.body;

  // Check if table_number is a positive number
  if (!Number.isInteger(tableNumber) || tableNumber <= 0)
    return next(new AppError("Table number must be a positive integer", 400));

  // Update the soft deleted table with the same name
  const upsertTable = await Table.findOneAndUpdate(
    {
      tableNumber,
      isDelete: true,
    },
    {
      status: "lock",
      isDelete: false,
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
      select: "_id tableNumber status",
    }
  );

  upsertTable.qrCode = await QRCode.toDataURL(upsertTable._id.toString(), {
    width: 800,
  });
  upsertTable.save();

  return res.status(201).json({
    status: "sucess",
    data: upsertTable,
  });
});

exports.updateTable = catchAsync(async (req, res, next) => {
  checkSpellFields(["tableNumber"], req.body);

  const { tableId } = req.params;
  const { tableNumber } = req.body;

  // Check if tableNumber is a positive number
  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    return next(new AppError("Table number must be a positive integer", 400));
  }

  await Table.findOneAndDelete({ tableNumber, isDelete: true });

  req.body.status = "lock";

  // Update table
  const updateTable = await Table.findByIdAndUpdate(tableId, req.body, {
    new: true,
    runValidators: true,
    select: "_id tableNumber status",
  });

  if (!updateTable)
    return next(new AppError("No table found with that ID", 404));

  res.status(200).json({
    status: "success",
    data: updateTable,
  });
});

exports.updateStatusTable = catchAsync(async (req, res, next) => {
  checkSpellFields(["status"], req.body);

  const { tableId } = req.params;
  const { status } = req.body;

  // Check required fields
  if (!status) return next(new AppError("Status is required", 400));

  const table = await Table.findById(tableId, {
    status: 1,
    currentUsers: 1,
  });

  if (status === "lock") {
    const unpaidOrders = await Order.find({ tableId, paymentStatus: "unpaid" });

    if (unpaidOrders.length > 0) {
      return next(new AppError("Bàn này chưa thanh toán", 400));
    }

    table.status = status;
    table.paymentStatus = "lock";
    table.currentUsers = [];
    table.currentStaffs = [];
  } else if (status === "open") {
    if (table.status === "open") {
      return next(new AppError("Bàn đã mở", 400));
    }
    table.status = status;
  }

  const updatedTable = await table.save();

  res.status(200).json({
    status: "success",
    data: updatedTable,
  });
});

exports.updatePaymentStatus = catchAsync(async (req, res, next) => {
  checkSpellFields(["paymentStatus"], req.body);

  const { tableId } = req.params;
  const { paymentStatus } = req.body;
  const staffId = req.user._id;

  // Check required fields
  if (!paymentStatus) {
    return next(new AppError("Payment status is required", 400));
  }

  const table = await Table.findById(tableId, {
    paymentStatus: 1,
    currentStaffs: 1,
  });

  if (paymentStatus === "lock") {
    table.paymentStatus = paymentStatus;
    table.currentStaffs = [];
  } else if (paymentStatus === "open") {
    if (table.paymentStatus === "open") {
      return next(new AppError("Bàn đã mở quyền thanh toán", 400));
    }
    table.paymentStatus = paymentStatus;
    table.currentStaffs.push(staffId);
  }

  const updatedPaymentStatus = await table.save();

  res.status(200).json({
    status: "success",
    data: updatedPaymentStatus,
  });
});

exports.softDeleteTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) return next(new AppError("No table found with this ID", 404));

  // Check if the table is open
  if (table.status === "open")
    return next(new AppError("Please lock the table", 400));

  // Delete table
  const deleteTable = await Table.findByIdAndUpdate(
    tableId,
    {
      isDelete: true,
    },
    {
      new: true,
      runValidators: true,
      select: "_id table_number status isDelete",
    }
  );

  res.status(200).json({
    status: "success",
    data: deleteTable,
  });
});

exports.hardDeleteTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) return next(new AppError("No table found with this ID", 404));

  // Check if the table is open
  if (table.status === "open")
    return next(new AppError("Please lock the table", 400));

  // Delete table
  const deleteTable = await Table.findByIdAndDelete(tableId);

  res.status(200).json({
    status: "success",
    data: deleteTable,
  });
});
