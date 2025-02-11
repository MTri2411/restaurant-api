const Category = require("../models/CategoryModel");
const MenuItem = require("../models/MenuItemModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const slugify = require("slugify");

exports.getCategories = catchAsync(async (req, res, next) => {
  const projection = {
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  // Get categories
  const categories = await Category.find({ isDelete: false }, projection);

  // Check if no category found
  if (categories.length === 0)
    return next(new AppError("Không tìm thấy danh mục nào", 404));

  res.status(200).json({
    success: "success",
    totalCategories: categories.length,
    data: categories,
  });
});

exports.createCategory = catchAsync(async (req, res, next) => {
  checkSpellFields(["name", "engName", "description"], req.body);

  const { name, engName, description } = req.body;

  // Create slug for category
  const slug = slugify(name, {
    locale: "vi",
    trim: true,
    lower: true,
  });

  // Update the soft deleted category with the same name
  const upsertCategory = await Category.findOneAndUpdate(
    {
      name,
      isDelete: true,
    },
    {
      name,
      engName: engName || "",
      description: description || "",
      slug,
      isDelete: false,
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
      select: "_id name engName description slug",
    }
  );

  return res.status(201).json({
    status: "sucess",
    data: upsertCategory,
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  checkSpellFields(["name", "engName", "description"], req.body);

  const { categoryId } = req.params;
  const { name } = req.body;

  await Category.findOneAndDelete({ name, isDelete: true });

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

  // Update new category in database
  const updateCategory = await Category.findByIdAndUpdate(
    categoryId,
    req.body,
    {
      new: true,
      runValidators: true,
      select: "_id name engName description slug",
    }
  );

  if (!updateCategory)
    return next(new AppError("No category found with that ID", 404));

  res.status(200).json({
    status: "success",
    data: updateCategory,
  });
});

exports.softDeleteCateogry = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  // Find category in collection categories
  const category = await Category.findById(categoryId);
  if (!category)
    return next(new AppError("No category found with this ID", 404));

  // Check category_id in collection menuItem
  const categoryInMenu = await MenuItem.findOne({ category_id: categoryId });
  if (categoryInMenu)
    return next(
      new AppError(
        "Can't delete this. There are still menu items in this category",
        400
      )
    );

  // Delete category
  const softDeleteCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      isDelete: true,
    },
    {
      new: true,
      runValidators: true,
      select: "_id name engName description slug isDelete",
    }
  );

  res.status(200).json({
    status: "success",
    data: softDeleteCategory,
  });
});

exports.hardDeleteCategory = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  // Find category in database
  const category = await Category.findById(categoryId);
  if (!category) {
    return next(new AppError("No category found with this ID", 404));
  }

  // Check category_id in collection menuItem
  const categoryInMenu = await MenuItem.findOne({ category_id: categoryId });
  if (categoryInMenu)
    return next(
      new AppError(
        "Can't delete this. There are still menu items in this category",
        400
      )
    );

  // Delete category
  const hardDeleteCategory = await Category.findByIdAndDelete(categoryId);

  res.status(200).json({
    status: "success",
    data: hardDeleteCategory,
  });
});
