const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

const router = express.Router();
router.use(authController.protect);

router.route("/").get(reviewController.getAllReviews);
router.route("/user-reviews").get(reviewController.getUserReviews);
router
  .route("/:menuItemId")
  .post(reviewController.filterProfanity, reviewController.createReview)
  .delete(reviewController.deleteReview);

router.route("/:reviewId").patch(reviewController.updateReview);

router.get("/menu-items", reviewController.getMenuItemsForReview);

module.exports = router;
