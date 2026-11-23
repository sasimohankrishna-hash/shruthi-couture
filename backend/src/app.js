const express = require("express");
const cors = require("cors");
const { createCollectionRoutes } = require("./routes/collectionRoutes");
const {
  createProductRoutes,
  createCollectionProductRoutes,
} = require("./routes/productRoutes");
const { createOrderRoutes } = require("./routes/orderRoutes");
const { createEnquiryRoutes } = require("./routes/enquiryRoutes");
const { createAdminRoutes } = require("./routes/adminRoutes");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/errorHandler");
const {
  createAuthenticatedSupabaseClient,
} = require("./config/supabase");

function parseAllowedOrigins(frontendUrl) {
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL must be configured.");
  }
  const origins = frontendUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("FRONTEND_URL must contain at least one origin.");
  }

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("FRONTEND_URL must contain valid origins.");
    }
    if (parsed.origin !== origin) {
      throw new Error("FRONTEND_URL must contain origins without paths or queries.");
    }

    const isLocalOrigin = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (parsed.protocol !== "https:" && !isLocalOrigin) {
      throw new Error(
        "FRONTEND_URL origins must use HTTPS except for localhost development.",
      );
    }
  }

  return origins;
}

function createApp({
  supabase,
  frontendUrl = process.env.FRONTEND_URL,
  authenticatedSupabaseClientFactory = createAuthenticatedSupabaseClient,
  uploadImage,
}) {
  if (!supabase) throw new Error("A Supabase client is required.");
  const allowedOrigins = parseAllowedOrigins(frontendUrl);
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (req, res) => {
    res.json({ success: true, message: "API is healthy", data: null });
  });

  app.use("/api/collections", createCollectionRoutes(supabase));
  app.use(
    "/api/collections/:collectionId/products",
    createCollectionProductRoutes(supabase),
  );
  app.use("/api/products", createProductRoutes(supabase));
  app.use(
    "/api/orders",
    createOrderRoutes(supabase, authenticatedSupabaseClientFactory),
  );
  app.use(
    "/api/admin",
    createAdminRoutes(
      supabase,
      authenticatedSupabaseClientFactory,
      uploadImage,
    ),
  );
  app.use("/api/enquiries", createEnquiryRoutes(supabase));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, parseAllowedOrigins };
