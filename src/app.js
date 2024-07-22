const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const compression = require("compression");
const cookieParser = require("cookie-parser");

//: ******* ROUTE HANDLERS *******
const AppError = require("./api/utils/AppError");
const globalErrorHandler = require("./api/controllers/errorController");
const userRouter = require("./api/routes/userRoutes");
const tableRouter = require("./api/routes/tableRoutes");
const categoryRouter = require("./api/routes/categoryRoutes");
const menuItemRouter = require("./api/routes/menuItemRoutes");
const orderRouter = require("./api/routes/orderRoutes");
const promotionRouter = require("./api/routes/promotionRoutes");
const paymentRouter = require("./api/routes/paymentRoutes");

//: ******* START EXPRESS APP *******
const app = express();

//: >>>>>>> START GLOBAL MIDDLEWARE >>>>>>>
// 1) cors
app.use(cors());

// 2) Serving static files
app.use(express.static(path.join(__dirname, "api/public")));

// 3) helmet
app.use(helmet());

// 4) Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// 5) Limit requests from same API
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: "Too many requests from this IP, please try again in an hour!",
// });
// app.use("/api", limiter);

// 6) Body parser, reading data from body into req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 7) Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// 8) Data sanitization against XSS
app.use(xss());

// 9) Compression
app.use(compression());

//: >>>>>>> END GLOBAL MIDDLEWARE >>>>>>>

//: ******* ROUTES *******
app.use("/v1/users", userRouter);
app.use("/v1/tables", tableRouter);
app.use("/v1/categories", categoryRouter);
app.use("/v1/menu-items", menuItemRouter);
app.use("/v1/orders", orderRouter);
app.use("/v1/payments", paymentRouter);
app.use("/v1/promotions", promotionRouter);

//: ******* ERROR HANDLING *******
// 1) Handle unhandled routes
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
