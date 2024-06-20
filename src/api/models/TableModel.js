const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    table_number: {
      type: Number,
      required: [true, "A table must have a number!"],
    },

    status: {
      type: String,
      enum: ["open", "lock"],
      default: "lock",
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

const Table = mongoose.model("table", tableSchema);
module.exports = Table;
