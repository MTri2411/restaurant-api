const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/UserModel");
const {
  sendVerificationEmail,
  sendResetPasswordMail,
} = require("../services/sendMailServices");
const { signToken } = require("../services/jwtServices");
const crypto = require("crypto");

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().select("-password");
  res.status(200).json({
    status: "success",
    data: {
      users,
    },
  });
});

exports.getUnverifiedUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({ isVerified: false }).select("-password");
  res.status(200).json({
    status: "success",
    data: {
      users,
    },
  });
});

exports.registerUser = catchAsync(async (req, res, next) => {
  const requiredFields = ["fullName", "email", "password"];

  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length) {
    return next(
      new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400)
    );
  }
  const user = await User.create(req.body);
  const verificationCode = Math.floor(100000 + Math.random() * 900000);
  user.verificationCode = verificationCode;
  await sendVerificationEmail(user.email, verificationCode);
  await user.save();

  res.status(201).json({
    status: "success",
    message: "User created successfully!",
  });
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, verificationCode } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError("User not found!", 404));
  }

  if (user.verificationCode !== verificationCode) {
    return next(new AppError("Invalid verification code!", 400));
  }

  user.isVerified = true;
  user.verificationCode = null;

  await user.save();

  res.status(200).json({
    status: "success",
    message: "Email verified successfully!",
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password!", 401));
  }

  if (!user.isVerified) {
    return next(new AppError("Please verify your email!", 401));
  }
  const token = signToken(user._id);
  res.status(200).json({
    status: "success",
    message: "Login successful!",
    data: {
      token,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const userObj = user.toObject();
  delete userObj.password;
  res.status(200).json({
    status: "success",
    message: "User retrieved successfully!",
    data: {
      user: userObj,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const allowedFields = ["fullName", "email"];
  Object.keys(req.body).forEach((field) => {
    if (allowedFields.includes(field)) {
      user[field] = req.body[field];
    }
  });
  if (req.file) {
    user.img_avatar_url = req.file.path;
  }
  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  res.status(200).json({
    status: "success",
    message: "User updated successfully!",
    data: {
      user: userObj,
    },
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);

  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError("Incorrect password!", 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Password changed successfully!",
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError("User not found!", 404));
  }
  const resetToken = user.createResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `http://127.0.0.1:3000/reset-password/${resetToken}`;

  try {
    sendResetPasswordMail(user.email, resetURL);
    res.status(200).json({
      status: "success",
      message: "Password reset email sent successfully!",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send email for password reset", 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const token = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const newToken = signToken(user._id);
  res.status(200).json({
    status: "success",
    message: "Password reset successful!",
    data: {
      token: newToken,
    },
  });
});

exports.resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError("User not found!", 404));
  }

  if (user.isVerified) {
    return next(new AppError("Email already verified!", 400));
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000);
  user.verificationCode = verificationCode;
  await sendVerificationEmail(user.email, verificationCode);
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Verification code resent successfully!",
  });
});

exports.deleteUserById = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return next(new AppError("User not found!", 404));
  }
  res.status(204).json({
    status: "success",
    message: "User deleted successfully!",
  });
});
