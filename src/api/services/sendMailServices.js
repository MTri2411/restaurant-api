const path = require("path");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// Tạo transporter như một singleton
let transporter = null;

const createTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const handlebarOptions = {
    viewEngine: {
      extName: ".handlebars",
      partialsDir: path.resolve(__dirname, "../views"),
      defaultLayout: false,
    },
    viewPath: path.resolve(__dirname, "../views"),
    extName: ".handlebars",
  };

  transporter.use("compile", hbs(handlebarOptions));

  return transporter;
};

exports.sendVerificationEmail = catchAsync(async (to, verificationCode) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    subject: "PRO2052: Account Verification",
    template: "emailTemplate",
    context: {
      verificationCode,
      isVerification: true,
    },
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
    throw new AppError("Failed to send email for verification", 500);
  }
});

exports.sendResetPasswordMail = catchAsync(async (to, resetURL) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    subject: "PRO2052: Reset Password",
    template: "emailTemplate",
    context: {
      resetURL,
      isReset: true,
    },
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
    throw new AppError("Failed to send email to reset password", 500);
  }
});
