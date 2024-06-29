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

const Table = mongoose.model("tables", tableSchema);
module.exports = Table;
