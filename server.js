const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const { server } = require("./src/app");

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

// const DB = "mongodb://localhost:27017/restaurantDB2";

mongoose.connect(DB).then(() => console.log("DB connection successful!"));

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`App running on port ${port}`);
});
