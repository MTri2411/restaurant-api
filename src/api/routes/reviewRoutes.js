const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

const router = express.Router();
router.use(authController.protect);

router
  .route("/")
  .post(reviewController.filterProfanity, reviewController.createReview);

module.exports = router;
