const express = require("express");
const orderController = require("../controllers/orderController");
const authController = require("../controllers/authController");
const promotionController = require("../controllers/promotionsController");
const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route("/")
  .get(promotionController.checkPromotionCode, orderController.getOrders)
  .post(
    authController.restrictTo("staff", "client"),
    orderController.createOrder
  );

router
  .route("/get-order-for-client")
  .get(
    promotionController.checkPromotionCode,
    orderController.getOrdersByOrderCount
  );

router
  .route("/items/:menuItemId")
  .patch(
    authController.restrictTo("staff", "client"),
    orderController.updateStatusItem
  )
  .delete(
    authController.restrictTo("staff", "client"),
    orderController.deleteOrderItem
  );

module.exports = router;
