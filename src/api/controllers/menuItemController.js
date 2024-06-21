const MenuItem = require("../models/MenuItemModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const slugify = require("slugify");

exports.getMenuItemsByCategoryId = catchAsync(async (req, res, next) => {
  const projection = {
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  const { categoryId } = req.params;

  // Get menu items
  const menuItemsByCategoryId = await MenuItem.find(
    {
      category_id: categoryId,
      isDelete: false,
    },
    projection
  );

  res.status(200).json({
    success: "success",
    totalMenuItems: menuItemsByCategoryId.length,
    data: menuItemsByCategoryId,
  });
});

exports.createMenuItem = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;
  const { name } = req.body;

  // Create slug for menu item
  const slug = slugify(name, {
    locale: "vi",
    trim: true,
    lower: true,
  });

  // Check already menu item by slug
  let existingMenuItem = await MenuItem.findOne({
    slug: slug,
  });

  req.body.slug = slug;
  req.body.isDelete = false;
  req.body.category_id = categoryId;

  if (existingMenuItem && existingMenuItem.isDelete === false) {
    return next(new AppError("You already have this menu item", 400));
  } else if (existingMenuItem && existingMenuItem.isDelete === true) {
    existingMenuItem = await MenuItem.findByIdAndUpdate(
      existingMenuItem._id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(201).json({
      status: "success",
      data: existingMenuItem,
    });
  }

  // Save new menu item in database
  const newMenuItem = await MenuItem.create(req.body);

  // Respone
  res.status(201).json({
    status: "success",
    data: newMenuItem,
  });
});

exports.updateMenuItem = catchAsync(async (req, res, next) => {
  const { categoryId, menuItemId } = req.params;
  const { name } = req.body;

  // Find menu item in database
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem)
    return next(new AppError("No menu item found with that ID", 404));

  // Create slug for menu item
  const slug = slugify(name, {
    locales: "vi",
    trim: true,
    lower: true,
  });

  // Check already menu item by slug
  const existingMenuItem = await MenuItem.find({
    slug: slug,
    _id: { $ne: menuItem._id },
  });

  if (existingMenuItem.length !== 0)
    return next(new AppError("You already have this menu item", 400));

  req.body.slug = slug;
  req.body.category_id = categoryId;

  // Update new menu item in database
  const updateMenuItem = await MenuItem.findByIdAndUpdate(
    menuItemId,
    req.body,
    {
      new: true,
      runValidators: true,
      select:
        "_id name engName description price image_url rating slug isDelete options category_id",
    }
  );

  res.status(200).json({
    status: "success",
    data: updateMenuItem,
  });
});

exports.softDeleteMenuItem = catchAsync(async (req, res, next) => {
  const { menuItemId } = req.params;

  // Find menu item in database
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem) {
    return next(new AppError("No category found with this ID", 404));
  }

  // Delete menu item
  const softDeleteMenuItem = await MenuItem.findByIdAndUpdate(
    menuItemId,
    {
      isDelete: true,
    },
    {
      new: true,
      runValidators: true,
      select:
        "_id name engName description price image_url rating slug isDelete options category_id",
    }
  );

  res.status(200).json({
    status: "success",
    data: softDeleteMenuItem,
  });
});

exports.hardDeleteMenuItem = catchAsync(async (req, res, next) => {
  const { menuItemId } = req.params;

  // Find menu item in database
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem) {
    return next(new AppError("No category found with this ID", 404));
  }

  // Delete menu item
  const hardDeleteMenuItem = await MenuItem.findByIdAndDelete(menuItemId);

  res.status(200).json({
    status: "success",
    data: hardDeleteMenuItem,
  });
});
