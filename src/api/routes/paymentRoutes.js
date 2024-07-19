const express = require("express");
const paymentController = require("../controllers/paymentController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router.route("/:tableId").post(paymentController.cashPayment);

router
  .route("/zalopayment-per-user")
  .post(authController.protect, paymentController.zaloPaymentPerUser);

router
  .route("/zalopayment-callback")
  .post(paymentController.zaloPaymentCallback);

module.exports = router;
