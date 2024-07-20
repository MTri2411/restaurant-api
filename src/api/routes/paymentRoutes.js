const express = require("express");
const paymentController = require("../controllers/paymentController");
const authController = require("../controllers/authController");

const router = express.Router();

router
  .route("/zalopayment-callback")
  .post(paymentController.zaloPaymentCallback);

router.use(authController.protect);

router.route("/cashpayment/:tableId").post(paymentController.cashPayment);

router.route("/zalopayment/:tableId").post(paymentController.zaloPayment);

module.exports = router;
