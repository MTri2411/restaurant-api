const express = require("express");
const promotionsController = require("../controllers/promotionsController");
const authController = require("../controllers/authController");

const router = express.Router();

router
  .route("/")
  .get(authController.protect, promotionsController.getPromotions);

router
  .route("/get-promotion-for-client")
  .get(authController.protect, promotionsController.getPromotionForClient);

router.use(authController.protect, authController.restrictTo("admin"));

router.route("/").post(promotionsController.createPromotion);
router
  .route("/create-promotion-with-points")
  .post(promotionsController.createPromotionWithPoints);
router.route("/:id").patch(promotionsController.updatePromotion);
router.route("/:id").delete(promotionsController.deletePromotion);

router
  .route("/update-status/:id")
  .patch(promotionsController.updatePromotionStatus);
router.route("/reset-promotion").post(promotionsController.resetAllPromotions);
router
  .route("/reset-promotion-version/:id")
  .post(promotionsController.resetPromotionVersion);

module.exports = router;
