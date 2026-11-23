const { validationResult } = require("express-validator");

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(400).json({
    success: false,
    message: "Invalid request",
    errors: result.array().map(({ path, msg }) => ({ field: path, message: msg })),
  });
}

module.exports = { validateRequest };
