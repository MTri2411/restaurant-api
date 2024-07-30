const express = require("express");
const paymentController = require("../controllers/paymentController");
const authController = require("../controllers/authController");
const promotionController = require("../controllers/promotionsController");
const router = express.Router();

router
  .route("/zalopayment-callback")
  .post(paymentController.zaloPaymentCallback);

router
  .route("/payment-notification")
  .get(paymentController.paymentNotification);

router
  .route("/payment-notification1")
  .get(paymentController.paymentNotification1);

router.use(authController.protect);

router
  .route("/cashpayment/:tableId")
  .post(promotionController.checkPromotionCode, paymentController.cashPayment);

router.route("/zalopayment/:tableId").post(paymentController.zaloPayment);

router.route("/payments-history").get(paymentController.getPaymentsHistory);

module.exports = router;
