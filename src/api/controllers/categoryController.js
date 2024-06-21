const Category = require("../models/CategoryModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
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
    return next(new AppError("No category found", 404));

  res.status(200).json({
    success: "success",
    totalCategories: categories.length,
    data: categories,
  });
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const { categoryName, categoryEngName, description } = req.body;

  // Create slug for category
  const slug = slugify(categoryName, {
    locale: "vi",
    trim: true,
    lower: true,
  });

  // Check already category by slug
  let existingCategory = await Category.findOne({
    slug: slug,
  });

  if (existingCategory && existingCategory.isDelete === false) {
    return next(new AppError("You already have this category", 400));
  } else if (existingCategory && existingCategory.isDelete === true) {
    existingCategory = await Category.findByIdAndUpdate(
      existingCategory._id,
      {
        engName: categoryEngName,
        description: description,
        isDelete: false,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(201).json({
      status: "success",
      data: existingCategory,
    });
  }

  // Save new category in database
  const newCategory = await Category.create({
    name: categoryName,
    engName: categoryEngName,
    description: description,
    slug: slug,
  });

  // Respone
  res.status(201).json({
    status: "success",
    data: newCategory,
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;
  const { categoryName, categoryEngName, description } = req.body;

  // Find category in database
  const category = await Category.findById(categoryId);
  if (!category)
    return next(new AppError("No category found with that ID", 404));

  // Create slug for category
  const slug = slugify(categoryName, {
    locales: "vi",
    trim: true,
    lower: true,
  });

  // Check already category by slug
  const existingCategory = await Category.find({
    slug: slug,
    _id: { $ne: category._id },
  });

  if (existingCategory !== 0)
    return next(new AppError("You already have this category", 400));

  // Update new category in database
  const updateCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      name: categoryName,
      engName: categoryEngName,
      description: description,
      slug: slug,
    },
    {
      new: true,
      runValidators: true,
      select: "_id name engName description slug isDelete",
    }
  );

  res.status(200).json({
    status: "success",
    data: updateCategory,
  });
});

exports.softDeleteCateogry = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  // Find category in database
  const category = await Category.findById(categoryId);
  if (!category) {
    return next(new AppError("No category found with this ID", 404));
  }

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

  // Delete category
  const hardDeleteCategory = await Category.findByIdAndDelete(categoryId);

  res.status(200).json({
    status: "success",
    data: hardDeleteCategory,
  });
});
