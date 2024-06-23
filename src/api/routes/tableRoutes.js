const express = require("express");
const orderRouter = require("./orderRoutes");
const tableController = require("../controllers/tableController");
const authController = require("../controllers/authController");

const router = express.Router({ mergeParams: true });

// redirect to order router (mergeParams)
router.use("/:tableId/orders/", orderRouter);

router.use(authController.protect);

router
  .route("/")
  .get(authController.restrictTo("admin", "staff"), tableController.getTables)
  .post(authController.restrictTo("admin"), tableController.createTable);

router
  .route("/:tableId")
  .get(authController.restrictTo("client"), tableController.checkStatusTable)
  .post(authController.restrictTo("admin"), tableController.createQRcode)
  .patch(authController.restrictTo("admin"), tableController.updateTable)
  .delete(authController.restrictTo("admin"), tableController.softDeleteTable);

router.route("/hd/:tableId").delete(authController.restrictTo("admin"), tableController.hardDeleteTable);

router
  .route("/update-status/:tableId")
  .patch(authController.restrictTo("staff"), tableController.updateStatusTable);

module.exports = router;
