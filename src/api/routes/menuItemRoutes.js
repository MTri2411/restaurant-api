const expresss = require("express");
const menuItemController = require("../controllers/menuItemController");
const authController = require("../controllers/authController");
const { upload } = require("../services/cloudinaryServices");

const router = expresss.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route("/")
  .get(menuItemController.getAllMenuItem)
  .post(
    authController.restrictTo("admin"),
    upload.single("image_url"),
    menuItemController.createMenuItem
  );

router
  .route("/get-by-category/:categoryId")
  .get(menuItemController.getMenuItemsByCategoryId);

router
  .route("/:menuItemId")
  .patch(
    authController.restrictTo("admin"),
    upload.single("image_url"),
    menuItemController.updateMenuItem
  )
  .delete(
    authController.restrictTo("admin"),
    menuItemController.deleteMenuItem
  );

router.get("/menu-items-reviewed", menuItemController.getMenuItemsWithReviews);
module.exports = router;
