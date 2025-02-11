const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("Bạn chưa đăng nhập! Vui lòng đăng nhập để tiếp tục.", 401)
    );
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    return next(
      new AppError(
        "Người dùng không tồn tại! Vui lòng đăng nhập lại.",
        401
      )
    );
  }

  req.user = user;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("Bạn không có quyền truy cập vào tài nguyên này.", 403)
      );
    }
    next();
  };
};
