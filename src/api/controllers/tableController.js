const Table = require("../models/TableModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const QRCode = require("qrcode");
const path = require("path");

exports.createQRcode = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Check tableId already exists
  const existingTableId = await Table.findById(tableId);
  if (!existingTableId) return next(new AppError("Table not found", 404));

  // Generate QRCode for table
  await QRCode.toFile(
    path.join(
      __dirname,
      `../public/img/qrCodeBan${existingTableId.table_number}.png`
    ),
    tableId
  );

  res.status(200).json({
    status: "success",
  });
});

exports.checkStatusTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  // Check status table
  const table = await Table.findById(tableId);
  if (table.status === "lock")
    return next(new AppError("Table is locked", 400));

  res.status(200).json({
    status: "success",
    message: `Table is opened`,
  });
});

exports.getTables = catchAsync(async (req, res, next) => {
  const projection = {
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  // Get tables
  const tables = await Table.find({ isDelete: false }, projection);

  // Check if no tables found
  if (tables.length === 0) {
    return next(new AppError("No tables found", 404));
  }

  res.status(200).json({
    success: "success",
    totalTables: tables.length,
    data: tables,
  });
});

exports.createTable = catchAsync(async (req, res, next) => {
  const { table_number } = req.body;

  // Check if table_number is a positive number
  if (!Number.isInteger(table_number) || table_number <= 0)
    return next(new AppError("Table number must be a positive integer", 400));

  // Check if the table already exists
  let existingTable = await Table.findOne({ table_number });
  if (existingTable && existingTable.isDelete === false) {
    return next(new AppError("Table has already existed", 400));
  } else if (existingTable && existingTable.isDelete === true) {
    existingTable = await Table.findByIdAndUpdate(
      existingTable._id,
      {
        status: "lock",
        isDelete: false,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(201).json({
      status: "success",
      data: existingTable,
    });
  }

  // Create table
  const newTable = await Table.create({ table_number });

  res.status(201).json({
    status: "success",
    data: newTable,
  });
});

exports.updateTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  const { table_number } = req.body;

  // Check if table_number is a positive number
  if (!Number.isInteger(table_number) || table_number <= 0)
    return next(new AppError("Table number must be a positive integer", 400));

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) {
    return next(new AppError("No table found with that ID", 404));
  }

  // Check table already exists
  const existingTable = await Table.find({
    table_number,
    _id: { $ne: table._id },
  });

  if (existingTable !== 0)
    return next(new AppError("This table number has already existed", 400));

  // Update table
  const updateTable = await Table.findByIdAndUpdate(
    tableId,
    { table_number: table_number, status: "lock" },
    {
      new: true,
      runValidators: true,
      select: "_id table_number status isDelete",
    }
  );

  res.status(200).json({
    status: "success",
    data: updateTable,
  });
});

exports.updateStatusTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  const { status } = req.body;

  // Check required fields
  if (!status) return next(new AppError("Status is required", 400));

  // Check valid status
  if (status !== "open" && status !== "lock")
    return next(new AppError("Invalid status value", 400));

  // Find table in database
  const table = await Table.findById(tableId);
  if (!table) return next(new AppError("No table found with this ID", 404));

  // Update table
  const updateStatusTable = await Table.findByIdAndUpdate(
    tableId,
    { status },
    {
      new: true,
      runValidators: true,
      select: "_id table_number status isDelete",
    }
  );

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

  // Delete table
  const deleteTable = await Table.findByIdAndDelete(tableId);

  res.status(200).json({
    status: "success",
    data: deleteTable,
  });
});
