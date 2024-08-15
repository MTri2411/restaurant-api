const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      unique: true,
      required: [true, "A table must have a number!"],
    },

    status: {
      type: String,
      enum: ["open", "lock"],
      default: "lock",
    },

    currentUsers: [
      { type: mongoose.Schema.ObjectId, ref: "User", default: [] },
    ],

    qrCode: {
      type: String,
    },

    isDelete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual
tableSchema.virtual("currentUsers.user", {
  ref: "User",
  localField: "currentUsers",
  foreignField: "_id",
});

const Table = mongoose.model("tables", tableSchema);
module.exports = Table;
