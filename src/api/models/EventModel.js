const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "A event must have a title!"],
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 150,
      required: [true, "A event must have a summary!"]
    },

    content: {
      type: String,
      trim: true,
      required: [true, "A event must have a content!"],
    },

    image_url: [
      {
        type: String,
        required: [true, "A event must have a image!"],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model("events", eventSchema);
module.exports = Event;
