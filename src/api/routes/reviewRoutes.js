const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

const router = express.Router();

router.route("/").get(authController.protect, authController.restrictTo("admin"), reviewController.getAllReviews);
router.use(authController.protect, authController.restrictTo("client"));
router.route("/").post(reviewController.filterProfanity, reviewController.createReview);
router.route("/my-reviews").get(reviewController.getMyReviews);
module.exports = router;
