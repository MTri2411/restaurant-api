const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/UserModel");
const { sendMail } = require("../services/sendMailServices");
const { signToken } = require("../services/jwtServices");

exports.getAllUsers = catchAsync(async (req, res, next) => {
  let users = await User.find();
  users = users.map((user) => {
    delete user._doc.password;
    return user;
  });
  res.status(200).json({
    status: "success",
    message: "Get all users successfully!",
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
  await sendMail(user.email, verificationCode);
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
  delete user._doc.password;
  res.status(200).json({
    status: "success",
    message: "User retrieved successfully!",
    data: {
      user,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const allowedFields = ["fullName", "email", "password"];
  Object.keys(req.body).forEach((field) => {
    if (allowedFields.includes(field)) {
      user[field] = req.body[field];
    }
  });
  if (req.file) {
    user.img_avatar_url = req.file.path;
  }
  await user.save();
  delete user._doc.password;
  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(204).json({
    status: "success",
    message: "User deleted successfully!",
  });
});
