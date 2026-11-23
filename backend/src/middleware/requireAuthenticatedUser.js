const { ApiError } = require("./errorHandler");

function createRequireAuthenticatedUser(supabase) {
  if (typeof supabase?.auth?.getUser !== "function") {
    throw new Error("A Supabase Auth client is required.");
  }

  return async function requireAuthenticatedUser(req, res, next) {
    const authorization = req.get("authorization") || "";
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "A Bearer access token is required",
      });
    }

    let result;
    try {
      result = await supabase.auth.getUser(match[1]);
    } catch {
      return next(new ApiError(503, "Authentication service unavailable"));
    }

    if (result.error) {
      const status = Number(result.error.status || result.error.statusCode);
      if (status >= 500) {
        return next(new ApiError(503, "Authentication service unavailable"));
      }
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    if (!result.data?.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    req.auth = {
      accessToken: match[1],
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
      },
    };
    return next();
  };
}

module.exports = { createRequireAuthenticatedUser };
