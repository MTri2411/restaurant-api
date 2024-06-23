const mongoose = require("mongoose");
const { trim } = require("validator");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "A category must have a name!"],
    },

    engName: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    slug: String,

    isDelete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // toJSON: {
    //   virtuals: true,
    //   transform: function (doc, ret) {
    //     delete ret.id;
    //   },
    // },
    // toObject: { virtuals: true },
  }
);

// categorySchema.virtual("items", {
//   ref: "menuItems",
//   localField: "_id",
//   foreignField: "category_id",
// });

const Category = mongoose.model("categories", categorySchema);
module.exports = Category;
