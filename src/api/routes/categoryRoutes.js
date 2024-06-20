const express = require("express");
const categoryController = require("../controllers/categoryController");
const menuItemRouter = require("./menuItemRoutes");

const router = express.Router();

router.use("/:categoryId/menu-items", menuItemRouter);

router
  .route("/")
  .get(categoryController.getCategories)
  .post(categoryController.createCategory);

router
  .route("/:categoryId")
  .patch(categoryController.updateCategory)
  .delete(categoryController.softDeleteCateogry);

router.route("/hd/:categoryId").delete(categoryController.hardDeleteCategory);

module.exports = router;
