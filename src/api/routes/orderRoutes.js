const express = require("express");
const orderController = require("../controllers/orderController");
const authController = require("../controllers/authController");

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route("/")
  .get(orderController.getOrderByUserId)
  .post(
    authController.restrictTo("staff", "client"),
    orderController.createOrder
  );

router
  .route("/get-order-by-tableId/:tableId")
  .get(orderController.getOrderByTableIdForStaff);

router
  .route("/get-order-by-tableId-for-client/:tableId")
  .get(orderController.getOrderByTableIdForClient);

router
  .route("/:itemId")
  .delete(
    authController.restrictTo("staff", "client"),
    orderController.deleteOrderItem
  );

router
  .route("/update-status/:itemId")
  .patch(authController.restrictTo("staff"), orderController.updateItemStatus);
module.exports = router;
