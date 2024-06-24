const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "A menu item must have a name!"],
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

    price: {
      type: Number,
      trim: true,
      required: [true, "A menu item must have a price!"],
    },

    image_url: {
      type: String,
      default:
        "https://res.cloudinary.com/dexkjvage/image/upload/v1718890934/DEFAULT_IMAGE_s9k5wq.jpg",
    },

    rating: {
      type: Number,
      default: 0,
    },

    slug: String,

    isDelete: {
      type: Boolean,
      default: false,
    },

    options: [
      {
        _id: false,

        name: {
          type: String,
          trim: true,
        },

        image_url: {
          type: String,
          default:
            "https://res.cloudinary.com/dexkjvage/image/upload/v1718890934/DEFAULT_IMAGE_s9k5wq.jpg",
        },
      },
    ],

    category_id: {
      type: mongoose.Schema.ObjectId,
      ref: "categories",
      required: [true, "Category id is required!"],
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

// // Virtual category
// menuItemSchema.virtual("category", {
//   ref: "categories",
//   localField: "category_id",
//   foreignField: "_id",
// });

const MenuItem = mongoose.model("menuItems", menuItemSchema);
module.exports = MenuItem;
