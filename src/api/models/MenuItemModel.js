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

    // options: [
    //   {
    //     _id: false,

    //     name: {
    //       type: String,
    //       trim: true,
    //     },

    //     image_url: {
    //       type: String,
    //       default:
    //         "https://res.cloudinary.com/dexkjvage/image/upload/v1718890934/DEFAULT_IMAGE_s9k5wq.jpg",
    //     },
    //   },
    // ],

    options: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "menuItems",
      },
    ],

    category_id: {
      type: mongoose.Schema.ObjectId,
      ref: "categories",
      required: [true, "Category id is required!"],
    },

    // reviews: [
    //   {
    //     type: mongoose.Schema.ObjectId,
    //     ref: "Reviews",
    //   },
    // ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        if (ret.options) {
          ret.options.forEach((element) => {
            delete element.id;
          });
        }
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual
menuItemSchema.virtual("options.optionItem", {
  ref: "menuItems",
  localField: "options",
  foreignField: "_id",
});

menuItemSchema.virtual("category_id.categoryInfor", {
  ref: "categories",
  localField: "category_id",
  foreignField: "_id",
});

menuItemSchema.virtual("reviews", {
  ref: "Reviews",
  localField: "_id",
  foreignField: "menuItem",
});

const MenuItem = mongoose.model("menuItems", menuItemSchema);
module.exports = MenuItem;
