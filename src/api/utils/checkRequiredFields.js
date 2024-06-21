const AppError = require("./AppError");

module.exports = (arrRequiredFields, data, next) => {
  const missingFields = arrRequiredFields.filter((field) => !data[field]);
  if (missingFields.length)
    throw new AppError(
      `Missing required fields: ${missingFields.join(", ")}`,
      400
    );
};
