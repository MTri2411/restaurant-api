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
    authController.restrictTo("client"),
    promotionController.checkPromotionCode,
    orderController.getOrdersForClient
  );

router
  .route("/get-order-for-staff")
  .get(
    authController.restrictTo("staff"),
    promotionController.checkPromotionCode,
    orderController.getOrdersForStaff
  );

router
  .route("/items/:itemId")
  .patch(
    authController.restrictTo("admin", "staff", "client"),
    orderController.updateStatusItem
  )
  .delete(
    authController.restrictTo("admin", "staff", "client"),
    orderController.deleteOrderItem
  );

module.exports = router;
