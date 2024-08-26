const express = require("express");
const paymentController = require("../controllers/paymentController");
const authController = require("../controllers/authController");
const promotionController = require("../controllers/promotionsController");
const router = express.Router();

router
  .route("/zalopayment-callback")
  .post(paymentController.zaloPaymentCallback);

router.use(authController.protect);

router
  .route("/cashpayment/:tableId")
  .post(
    authController.restrictTo("staff"),
    promotionController.checkPromotionCode,
    paymentController.cashPayment
  );

router
  .route("/zalopayment/:tableId")
  .post(
    authController.restrictTo("client"),
    paymentController.sendNotificationBeforeZaloPayment,
    promotionController.checkPromotionCode,
    paymentController.zaloPayment
  );

router
  .route("/notification-payment")
  .post(authController.restrictTo("client"),paymentController.sendNotificationBeforePayment);

router.route("/payments-history").get(paymentController.getPaymentsHistory);

router
  .route("/payments-history/:id")
  .get(paymentController.getPaymentsHistoryDetail);

module.exports = router;
