const expresss = require("express");
const menuItemController = require("../controllers/menuItemController");
const authController = require("../controllers/authController");

const router = expresss.Router({ mergeParams: true });

// router.use(authController.protect);

router
  .route("/")
  .get(menuItemController.getAllMenuItem)
  .post(authController.restrictTo("admin"), menuItemController.createMenuItem);

router
  .route("/get-by-category/:categoryId")
  .get(menuItemController.getMenuItemsByCategoryId);

// router
//   .route("/:menuItemId")
//   .patch(menuItemController.updateMenuItem)
//   .delete(menuItemController.softDeleteMenuItem);

// router.route("/hd/:menuItemId").delete(menuItemController.hardDeleteMenuItem);

module.exports = router;
