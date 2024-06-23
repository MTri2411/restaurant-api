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
    return next(new AppError("No category found", 404));

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
    }
  );

  return res.status(201).json({
    status: "sucess",
    data: upsertCategory,
  });

  // // Check already category by slug
  // let existingCategory = await Category.findOne({
  //   slug: slug,
  // });

  // if (existingCategory && existingCategory.isDelete === false)
  //   return next(new AppError("You already have this category", 400));

  // if (existingCategory && existingCategory.isDelete === true) {
  //   existingCategory = await Category.findByIdAndUpdate(
  //     existingCategory._id,
  //     {
  //       name,
  //       engName: engName || "",
  //       description: description || "",
  //       slug,
  //       isDelete: false,
  //     },
  //     {
  //       new: true,
  //       runValidators: true,
  //     }
  //   );

  //   return res.status(201).json({
  //     status: "success",
  //     data: existingCategory,
  //   });
  // }

  // Save new category in database
  // const newCategory = await Category.create({
  //   name,
  //   engName,
  //   description,
  //   slug,
  // });

  // // Respone
  // res.status(201).json({
  //   status: "success",
  //   data: newCategory,
  // });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  checkSpellFields(["name", "engName", "description"], req.body);

  const { categoryId } = req.params;
  const { name } = req.body;

  // // Find category in database
  // const category = await Category.findById(categoryId);
  // if (!category)
  //   return next(new AppError("No category found with that ID", 404));

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

  // // Check already category name by slug
  // const existingCategory = await Category.find({
  //   slug: slug,
  //   _id: { $ne: category._id }, // Find all categories except itself
  // });

  // if (existingCategory.length !== 0)
  //   return next(new AppError("You already have this category", 400));

  // Update new category in database
  const updateCategory = await Category.findByIdAndUpdate(
    categoryId,
    req.body,
    {
      new: true,
      runValidators: true,
      select: "_id name engName description slug isDelete",
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
