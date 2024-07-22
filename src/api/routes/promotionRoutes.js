const express = require("express");
const promotionsController = require("../controllers/promotionsController");
const authController = require("../controllers/authController");

const router = express.Router();
router.route("/:id").get(promotionsController.getPromotion);

router.use(authController.protect, authController.restrictTo("admin"));

router.route("/").get(promotionsController.getPromotions);
router.route("/").post(promotionsController.createPromotion);
router.route("/:id").patch(promotionsController.updatePromotion);
router.route("/:id").delete(promotionsController.deletePromotion);
router.route("/reset-promotion").post(promotionsController.resetAllPromotions);
module.exports = router;
