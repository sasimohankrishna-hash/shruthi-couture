class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Request body must contain valid JSON",
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const message =
    status >= 500 ? "Something went wrong" : error.message;
  const response = { success: false, message };

  if (error.code && status < 500) response.code = error.code;

  if (status >= 500) {
    console.error("API request failed", {
      method: req.method,
      path: req.path,
      error: error.message,
    });
  }

  return res.status(status).json(response);
}

module.exports = { ApiError, errorHandler, notFoundHandler };
