const firebase = require("firebase-admin");
const configJsonFirebase = require("./configJsonFirebase.json");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

firebase.initializeApp({
  credential: firebase.credential.cert(configJsonFirebase),
});

const sendNotification = catchAsync(async (tokens, payload) => {
  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    android: {
      notification: {
        imageUrl: payload.image_url,
      },
    },
  };

  const response = await firebase.messaging().sendEachForMulticast(message);
});

module.exports = { sendNotification };
