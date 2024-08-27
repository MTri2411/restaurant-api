const Event = require("../models/EventModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const checkSpellFields = require("../utils/checkSpellFields");
const { cloudinary } = require("../services/cloudinaryServices");
const { sendNotification } = require("../firebase/initializeFirebase");

exports.deleteOldImage = catchAsync(async (req, res, next) => {
  checkSpellFields(["title", "summary", "content", "deleteImages"], req.body);
  const { eventId } = req.params;
  const { deleteImages } = req.body;

  const event = await Event.findById(eventId);
  if (!event) {
    return next(new AppError("Event not found", 404));
  }

  if (deleteImages && Array.isArray(deleteImages)) {
    for (const url of deleteImages) {
      const publicId = url.split("/").slice(-2).join("/").replace(".jpg", "");
      await cloudinary.uploader.destroy(publicId);
      event.image_url = event.image_url.filter((img) => img !== url);
    }
  }

  req.updateImage_url = event.image_url;
  next();
});

exports.getEvent = catchAsync(async (req, res, next) => {
  const events = await Event.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    totalEvent: events.length,
    data: events,
  });
});

exports.getEventById = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    return next(new AppError("Event not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: event,
  });
});

exports.createEvent = catchAsync(async (req, res, next) => {
  checkSpellFields(["title", "summary", "content"], req.body);

  const { title, summary } = req.body;
  const imageUrls = req.files.map((file) => file.path);

  req.body.image_url = imageUrls;

  const newEvent = await Event.create(req.body);
  const users = await User.find({ role: "client" }, { role: 1, FCMTokens: 1 });
  const tokens = users
    .map((user) => user.FCMTokens)
    .filter((token) => token !== "");
  const payload = {
    title,
    body: summary,
    data: {
      eventId: newEvent._id.toString(),
      type: "events",
    },
    image_url: imageUrls[0],
  };

  sendNotification(tokens, payload);

  // Respone
  res.status(201).json({
    status: "success",
    data: newEvent,
  });
});

exports.updateEvent = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;

  const newImageUrls = req.files.map((file) => file.path);
  req.body.image_url = [...req.updateImage_url, ...newImageUrls];

  const updateEvent = await Event.findByIdAndUpdate(eventId, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: updateEvent,
  });
});

exports.deleteEvent = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    return next(new AppError("Event not found", 404));
  }
  for (const url of event.image_url) {
    const publicId = url.split("/").slice(-2).join("/").replace(".jpg", "");
    await cloudinary.uploader.destroy(publicId);
  }

  await Event.findByIdAndDelete(eventId);

  res.status(200).json({
    status: "success",
    message: "Delete successfully!!!",
  });
});
