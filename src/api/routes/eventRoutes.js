const express = require("express");
const eventController = require("../controllers/eventController");
const authController = require("../controllers/authController");
const { upload } = require("../services/cloudinaryServices");

const router = express.Router();

router.use(authController.protect);

router.route("/").get(eventController.getEvent);
router
  .route("/")
  .post(
    authController.restrictTo("admin"),
    upload.array("images", 5),
    eventController.createEvent
  );
router
  .route("/:eventId")
  .get(eventController.getEventById)
  .patch(
    authController.restrictTo("admin"),
    upload.array("images", 5),
    eventController.deleteOldImage,
    eventController.updateEvent
  )
  .delete(authController.restrictTo("admin"), eventController.deleteEvent);

module.exports = router;
