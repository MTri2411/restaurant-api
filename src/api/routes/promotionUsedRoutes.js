const express = require("express");
const promotionsUsedController = require("../controllers/promotionsUsedController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router.route("/").get(promotionsUsedController.getPromotionsUsed);

module.exports = router;
