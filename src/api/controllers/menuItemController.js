const MenuItem = require("../models/MenuItemModel");
const Category = require("../models/CategoryModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const slugify = require("slugify");

exports.getAllMenuItem = catchAsync(async (req, res, next) => {
  const projection = {
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  // Get menu items
  let menuItems = await MenuItem.find({}, projection)
    .populate({ path: "options", select: "name image_url" })
    .populate({ path: "category_id", select: "name engName " })
    .lean();

  for (const menuItem of menuItems) {
    const category = await Category.findOne({ _id: menuItem.category_id });

    if (category) {
      menuItem.category = category.name;
    }
  }

  res.status(200).json({
    success: "success",
    totalMenuItems: menuItems.length,
    data: menuItems,
  });
});

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
    },
    projection
  ).populate({ path: "options", select: "name image_url" });

  res.status(200).json({
    success: "success",
    totalMenuItems: menuItemsByCategoryId.length,
    data: menuItemsByCategoryId,
  });
});

exports.createMenuItem = catchAsync(async (req, res, next) => {
  const arrSchemaFields = [
    "name",
    "engName",
    "description",
    "price",
    "image_url",
    "options",
  ];
  checkSpellFields(arrSchemaFields, req.body);

  const { categoryId } = req.params;
  const { name, options } = req.body;

  // Create slug for menu item
  const slug = slugify(name, {
    locale: "vi",
    trim: true,
    lower: true,
  });

  req.body.slug = slug;
  req.body.category_id = categoryId;

  if (options) {
    req.body.options = JSON.parse(options);
  }

  if (req.file) {
    req.body.image_url = req.file.path;
  }

  const newMenuItem = await MenuItem.create(req.body);

  // Respone
  res.status(201).json({
    status: "success",
    data: newMenuItem,
  });
});

exports.updateMenuItem = catchAsync(async (req, res, next) => {
  const arrSchemaFields = [
    "name",
    "engName",
    "description",
    "price",
    "image_url",
    "options",
  ];
  checkSpellFields(arrSchemaFields, req.body);

  const { categoryId, menuItemId } = req.params;
  const { name, options } = req.body;

  // Create slug for category
  let slug = null;
  if (name) {
    slug = slugify(name, {
      locales: "vi",
      trim: true,
      lower: true,
    });

    req.body.slug = slug;
  }
  
  req.body.category_id = categoryId;

  if (options) {
    req.body.options = JSON.parse(options);
  }

  if (req.file) {
    req.body.image_url = req.file.path;
  }

  const updateMenuItem = await MenuItem.findByIdAndUpdate(
    menuItemId,
    req.body,
    { new: true, runValidators: true }
  );

  // Respone
  res.status(201).json({
    status: "success",
    data: updateMenuItem,
  });
});

// exports.hardDeleteMenuItem = catchAsync(async (req, res, next) => {
//   const { menuItemId } = req.params;

//   // Find menu item in database
//   const menuItem = await MenuItem.findById(menuItemId);
//   if (!menuItem) {
//     return next(new AppError("No category found with this ID", 404));
//   }

//   // Delete menu item
//   const hardDeleteMenuItem = await MenuItem.findByIdAndDelete(menuItemId);

//   res.status(200).json({
//     status: "success",
//     data: hardDeleteMenuItem,
//   });
// });
