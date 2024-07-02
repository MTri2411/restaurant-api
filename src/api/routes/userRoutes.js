const express = require("express");
const tableRouter = require("./tableRoutes");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const upload = require("../services/cloudinaryServices");

const router = express.Router();

// redirect to table router (mergeParams)
router.use("/:userId/tables/", tableRouter);

router
  .route("/")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    userController.getAllUsers
  );

router
  .route("/unverified")
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    userController.getUnverifiedUsers
  );

router.route("/register").post(userController.registerUser);
router.route("/verify").post(userController.verifyEmail);
router.route("/login").post(userController.login);
router.route("/forgot-password").post(userController.forgotPassword);
router.route("/reset-password/:token").patch(userController.resetPassword);
router.route("/resend-verification").post(userController.resendVerification);
router.route("/me").get(authController.protect, userController.getUser);
router
  .route("/update-password")
  .patch(authController.protect, userController.updatePassword);

router
  .route("/update-me")
  .patch(
    authController.protect,
    upload.single("img_avatar_url"),
    userController.updateUser
  );

router
  .route("/delete-user")
  .delete(
    authController.protect,
    authController.restrictTo("admin"),
    userController.deleteUser
  );

module.exports = router;
