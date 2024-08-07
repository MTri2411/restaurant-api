const fs = require("fs");
const path = require("path");

const profanityFilePath = path.join(
  __dirname,
  "../validations",
  "badwords.txt"
);

const profanityWords = fs.readFileSync(profanityFilePath, "utf-8");

const profanityList = profanityWords
  .split("\n")
  .map((word) => word.trim().toLowerCase())
  .filter((word) => word.length > 0);

module.exports = profanityList;
