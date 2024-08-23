const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new Schema({
  fullName: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[\p{L}\s]+$/u.test(v);
      },
      message: (props) => `${props.value} is not a valid last name!`,
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid email address!`,
    },
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/.test(v);
      },
      message: (props) =>
        `Password must contain at least 8 characters, including uppercase, lowercase letters and numbers!`,
    },
  },
  img_avatar_url: {
    type: String,
    default:
      "https://res.cloudinary.com/df44phxv9/image/upload/v1718237515/PRO2052/frx8qlue8l1xjfiqty6k.png",
  },
  role: {
    type: String,
    enum: ["staff", "client", "admin"],
    required: true,
    default: "client",
  },
  verificationCode: {
    type: String,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  points: {
    type: Number,
    default: 0,
  },
  usedPromotions: [
    {
      promotion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Promotion",
      },
      timesUsed: {
        type: Number,
        default: 0,
      },
    },
  ],
  passwordChangedAt: Date,

  passwordResetToken: String,

  passwordResetExpires: Date,

  FCMTokens: {
    type: String,
    default: "",
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.createResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
