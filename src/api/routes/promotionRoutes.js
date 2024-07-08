const express = require("express");
const promotionsController = require("../controllers/promotionsController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect, authController.restrictTo("admin"));

router.route("/").get(promotionsController.getAllPromotions);
router.route("/").post(promotionsController.createPromotion);

module.exports = router;
