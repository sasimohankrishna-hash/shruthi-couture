const express = require("express");
const { body, param } = require("express-validator");
const { rateLimit } = require("express-rate-limit");
const { createOrderController } = require("../controllers/orderController");
const {
  createAuthenticatedSupabaseClient,
} = require("../config/supabase");
const {
  createRequireAuthenticatedUser,
} = require("../middleware/requireAuthenticatedUser");
const { createRequireAdministrator } = require("../middleware/requireAdministrator");
const { validateRequest } = require("../middleware/validateRequest");

function createOrderLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many order requests. Please try again later.",
    },
  });
}

function createOrderRoutes(
  supabase,
  authenticatedSupabaseClientFactory = createAuthenticatedSupabaseClient,
) {
  const router = express.Router();
  const controller = createOrderController(
    supabase,
    authenticatedSupabaseClientFactory,
  );
  const requireAuthenticatedUser = createRequireAuthenticatedUser(supabase);
  const requireAdministrator = createRequireAdministrator(
    authenticatedSupabaseClientFactory,
  );

  router.post(
    "/",
    createOrderLimiter(),
    body("customerName")
      .isString()
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage("Customer name is required and must be at most 120 characters"),
    body("customerPhone")
      .isString()
      .trim()
      .matches(/^[+0-9().\-\s]{7,25}$/)
      .withMessage("Enter a valid phone number"),
    body("items")
      .isArray({ min: 1, max: 50 })
      .withMessage("Items must contain between 1 and 50 variants"),
    body("items").custom((items) => {
      if (!Array.isArray(items)) return true;
      const variantIds = items
        .map((item) =>
          typeof item?.variantId === "string"
            ? item.variantId.toLowerCase()
            : null,
        )
        .filter(Boolean);
      if (new Set(variantIds).size !== variantIds.length) {
        throw new Error("Each variantId may appear only once");
      }
      return true;
    }),
    body("items.*")
      .custom((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          Object.keys(item).some((key) => !["variantId", "quantity"].includes(key))
        ) {
          throw new Error("Each item may contain only variantId and quantity");
        }
        return true;
      }),
    body("items.*.variantId")
      .isUUID()
      .withMessage("Each variantId must be a UUID"),
    body("items.*.quantity")
      .custom(
        (value) =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 1000,
      )
      .withMessage("Each quantity must be an integer between 1 and 1000"),
    body()
      .custom((value) =>
        Object.keys(value || {}).every((key) =>
          ["customerName", "customerPhone", "items"].includes(key),
        ),
      )
      .withMessage("Only customerName, customerPhone, and items are accepted"),
    validateRequest,
    controller.create,
  );

  router.post(
    "/:orderId/confirm",
    requireAuthenticatedUser,
    requireAdministrator,
    param("orderId")
      .isUUID()
      .withMessage("Order ID must be a UUID"),
    validateRequest,
    controller.confirm,
  );

  return router;
}

module.exports = { createOrderRoutes };
