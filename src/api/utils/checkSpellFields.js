const AppError = require("./AppError");

module.exports = (arrSchemaFields, data) => {
  const bodyFields = Object.keys(data);
  const invalidFields = bodyFields.filter(
    (field) => !arrSchemaFields.includes(field)
  );

  if (invalidFields.length > 0)
    throw new AppError(`Invalid fields: ${invalidFields.join(", ")}`, 400);
};
