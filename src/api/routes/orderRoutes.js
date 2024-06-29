const express = require("express");
const orderController = require("../controllers/orderController");
const authController = require("../controllers/authController");

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route("/")
  .post(
    authController.restrictTo("staff", "client"),
    orderController.createOrder
  );

router
  .route("/:itemId")
  .delete(
    authController.restrictTo("staff", "client"),
    orderController.deleteOrderItem
  );

module.exports = router;
