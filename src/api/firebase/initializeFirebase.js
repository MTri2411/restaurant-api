const firebase = require("firebase-admin");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const fs = require("fs");
const configPath =
  process.env.CONFIG_JSON_FIREBASE_PATH ||
  "./src/api/firebase/configJsonFirebase.json";
const configJsonFirebase = JSON.parse(fs.readFileSync(configPath, "utf8"));

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
  console.log("Firebase log >>>>>>> ", response.responses[0].error);
});

module.exports = { sendNotification };
