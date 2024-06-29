const MenuItem = require("../models/MenuItemModel");
const Category = require("../models/CategoryModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const slugify = require("slugify");

exports.getAllMenuItem = catchAsync(async (req, res, next) => {
  const projection = {
    idDelete: true,
    createdAt: 0,
    updatedAt: 0,
    __v: 0,
  };

  // Get menu items
  let menuItems = await MenuItem.find(
    {
      isDelete: false,
    },
    projection
  ).lean();

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
    isDelete: true,
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
  const arrSchemaFields = [
    "name",
    "engName",
    "description",
    "price",
    "image_url",
    "rating",
    "options",
  ];
  checkSpellFields(arrSchemaFields, req.body);

  const { categoryId } = req.params;
  const { name, engName, description, price, image_url, rating, options } =
    req.body;

  // Create slug for menu item
  const slug = slugify(name, {
    locale: "vi",
    trim: true,
    lower: true,
  });

  // Update the soft deleted menuItem with the same name
  const upsertMenuItem = await MenuItem.findOneAndUpdate(
    {
      name,
      isDelete: true,
    },
    {
      engName: engName || "",
      description: description || "",
      price,
      image_url:
        image_url ||
        "https://res.cloudinary.com/dexkjvage/image/upload/v1718890934/DEFAULT_IMAGE_s9k5wq.jpg",
      rating: rating || 0,
      options: options || [],
      slug,
      isDelete: false,
      category_id: categoryId,
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  // Respone
  res.status(201).json({
    status: "success",
    data: upsertMenuItem,
  });
});

// exports.updateMenuItem = catchAsync(async (req, res, next) => {
//   const { categoryId, menuItemId } = req.params;
//   const { name } = req.body;

//   // Find menu item in database
//   const menuItem = await MenuItem.findById(menuItemId);
//   if (!menuItem)
//     return next(new AppError("No menu item found with that ID", 404));

//   // Create slug for menu item
//   const slug = slugify(name, {
//     locales: "vi",
//     trim: true,
//     lower: true,
//   });

//   // Check already menu item by slug
//   const existingMenuItem = await MenuItem.find({
//     slug: slug,
//     _id: { $ne: menuItem._id },
//   });

//   if (existingMenuItem.length !== 0)
//     return next(new AppError("You already have this menu item", 400));

//   req.body.slug = slug;
//   req.body.category_id = categoryId;

//   // Update new menu item in database
//   const updateMenuItem = await MenuItem.findByIdAndUpdate(
//     menuItemId,
//     req.body,
//     {
//       new: true,
//       runValidators: true,
//       select:
//         "_id name engName description price image_url rating slug isDelete options category_id",
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     data: updateMenuItem,
//   });
// });

// exports.softDeleteMenuItem = catchAsync(async (req, res, next) => {
//   const { menuItemId } = req.params;

//   // Find menu item in database
//   const menuItem = await MenuItem.findById(menuItemId);
//   if (!menuItem) {
//     return next(new AppError("No category found with this ID", 404));
//   }

//   // Delete menu item
//   const softDeleteMenuItem = await MenuItem.findByIdAndUpdate(
//     menuItemId,
//     {
//       isDelete: true,
//     },
//     {
//       new: true,
//       runValidators: true,
//       select:
//         "_id name engName description price image_url rating slug isDelete options category_id",
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     data: softDeleteMenuItem,
//   });
// });

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
