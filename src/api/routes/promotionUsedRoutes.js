const express = require("express");
const promotionsUsedController = require("../controllers/promotionsUsedController");
const authController = require("../controllers/authController");

const router = express.Router();
router.route("/").get(promotionsUsedController.migratePromotionsUsed);
router.route("/create").post(promotionsUsedController.createPromotionsUsed);
module.exports = router;
