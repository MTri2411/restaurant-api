const expresss = require("express");
const menuItemController = require("../controllers/menuItemController");

const router = expresss.Router({ mergeParams: true });

router
  .route("/")
  .get(menuItemController.getMenuItemsByCategoryId)
  .post(menuItemController.createMenuItem);

router
  .route("/:menuItemId")
  .patch(menuItemController.updateMenuItem)
  .delete(menuItemController.softDeleteMenuItem);

router.route("/hd/:menuItemId").delete(menuItemController.hardDeleteMenuItem);

module.exports = router;
