const { ApiError } = require("./errorHandler");

function createRequireAdministrator(createAuthenticatedSupabaseClient) {
  return async function requireAdministrator(req, res, next) {
    try {
      const userSupabase = createAuthenticatedSupabaseClient(
        req.auth.accessToken,
      );
      const { data, error } = await userSupabase.rpc("is_admin");

      if (error) {
        return next(new ApiError(502, "Could not verify administrator access"));
      }
      if (data !== true) {
        return res.status(403).json({
          success: false,
          message: "Administrator access required",
        });
      }

      return next();
    } catch {
      return next(new ApiError(502, "Could not verify administrator access"));
    }
  };
}

module.exports = { createRequireAdministrator };
