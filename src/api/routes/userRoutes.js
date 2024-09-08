const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const { upload } = require("../services/cloudinaryServices");

const router = express.Router();
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
router.route("/login-admin").post(userController.loginAdmin);
router.route("/logout").post(authController.protect, userController.logout);
router.route("/forgot-password").post(userController.forgotPassword);
router.route("/reset-password/:token").patch(userController.resetPassword);
router
  .route("/forgot-password-for-client")
  .post(userController.forgotPasswordForClient);
router
  .route("/reset-password-for-client")
  .patch(userController.resetPasswordForClient);
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
  .route("/delete-user/:id")
  .delete(
    authController.protect,
    authController.restrictTo("admin"),
    userController.deleteUserById
  );

router
  .route("/update-user/:id")
  .patch(
    authController.protect,
    authController.restrictTo("admin"),
    userController.updateUserByAdmin
  );
module.exports = router;
