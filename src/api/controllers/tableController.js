const Table = require("../models/TableModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const QRCode = require("qrcode");
const path = require("path");

exports.createQRcode = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) return next(new AppError("Table not found", 404));

  // Generate QRCode for table
  await QRCode.toFile(
    path.join(__dirname, `../public/img/qrCodeBan${table.tableNumber}.png`),
    tableId
  );

  res.status(200).json({
    status: "success",
  });
});

exports.checkStatusTable = catchAsync(async (req, res, next) => {
  const projection = {
    isDelete: 0,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  const { tableId } = req.params;

  // Check status table
  const table = await Table.findById(tableId, projection);

  res.status(200).json({
    status: "success",
    data: table,
  });
});

exports.getTables = catchAsync(async (req, res, next) => {
  const projection = {
    isDelete: 0,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

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

  upsertTable.qrCode = await QRCode.toDataURL(upsertTable._id.toString());
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
  checkSpellFields(["tableNumber", "status"], req.body);

  const { tableId } = req.params;
  const { status } = req.body;

  // Check required fields
  if (!status) return next(new AppError("Status is required", 400));

  // Update table
  const updateStatusTable = await Table.findByIdAndUpdate(
    tableId,
    { status },
    {
      new: true,
      runValidators: true,
      select: "_id tableNumber status",
    }
  );

  if (!updateStatusTable)
    return next(new AppError("No table found with this ID", 404));

  res.status(200).json({
    status: "success",
    data: updateStatusTable,
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
