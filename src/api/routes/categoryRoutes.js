const express = require("express");
const categoryController = require("../controllers/categoryController");
const menuItemRouter = require("./menuItemRoutes");
const authController = require("../controllers/authController");

const router = express.Router();

// redirect to menuItem router (mergeParams)
router.use("/:categoryId/menu-items", menuItemRouter);

router.use(authController.protect);

router
  .route("/")
  .get(categoryController.getCategories)
  .post(authController.restrictTo("admin"), categoryController.createCategory);

router
  .route("/:categoryId")
  .patch(authController.restrictTo("admin"), categoryController.updateCategory)
  .delete(
    authController.restrictTo("admin"),
    categoryController.softDeleteCateogry
  );

router
  .route("/hd/:categoryId")
  .delete(
    authController.restrictTo("admin"),
    categoryController.hardDeleteCategory
  );

module.exports = router;
