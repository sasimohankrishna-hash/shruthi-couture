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
      .withMessage("Items must contain between 1 and 50 products or variants"),
    body("items").custom((items) => {
      if (!Array.isArray(items)) return true;
      const itemIds = items
        .map((item) => {
          if (typeof item?.variantId === "string") {
            return `variant:${item.variantId.toLowerCase()}`;
          }
          if (typeof item?.productId === "string") {
            return `product:${item.productId.toLowerCase()}`;
          }
          return null;
        })
        .filter(Boolean);
      if (new Set(itemIds).size !== itemIds.length) {
        throw new Error("Each product or variant may appear only once");
      }
      return true;
    }),
    body("items.*")
      .custom((item) => {
        const hasVariantId =
          item && typeof item === "object" && Object.hasOwn(item, "variantId");
        const hasProductId =
          item && typeof item === "object" && Object.hasOwn(item, "productId");
        const selectedId = hasVariantId ? item.variantId : item?.productId;
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          Object.keys(item).some(
            (key) => !["variantId", "productId", "quantity"].includes(key),
          ) ||
          hasVariantId === hasProductId ||
          typeof selectedId !== "string"
        ) {
          throw new Error("Each item must contain exactly one productId or variantId");
        }
        return true;
      }),
    body("items.*.variantId")
      .optional()
      .isUUID()
      .withMessage("Each variantId must be a UUID"),
    body("items.*.productId")
      .optional()
      .isUUID()
      .withMessage("Each productId must be a UUID"),
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
