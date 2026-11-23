const express = require("express");
const { body, param } = require("express-validator");
const { createAdminCatalogueController } = require("../controllers/adminCatalogueController");
const { createRequireAdministrator } = require("../middleware/requireAdministrator");
const { validateRequest } = require("../middleware/validateRequest");

const slugRule = (field) =>
  body(field)
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage("Use a lowercase slug with letters, numbers, and hyphens");
const textRule = (field, max, required = false) => {
  const rule = body(field);
  return (required ? rule : rule.optional())
    .isString()
    .trim()
    .isLength({ min: required ? 1 : 0, max })
    .withMessage(`${field} must be ${required ? "required and " : ""}at most ${max} characters`);
};
const optionalBoolean = (field) =>
  body(field).optional().isBoolean().withMessage(`${field} must be a boolean`);
const optionalSortOrder = (field = "sortOrder") =>
  body(field).optional().isInt({ min: 0 }).toInt()
    .withMessage(`${field} must be a non-negative integer`);
const strictBody = (fields) =>
  body().custom((value) =>
    Object.keys(value || {}).every((field) => fields.includes(field)),
  ).withMessage("Request contains unsupported fields");
const nonEmptyBody = () =>
  body().custom((value) => Object.keys(value || {}).length > 0)
    .withMessage("Request body must contain at least one field");

function createAdminCatalogueRoutes(
  supabase,
  createAuthenticatedSupabaseClient,
  requireAuthenticatedUser,
) {
  const router = express.Router();
  router.use(requireAuthenticatedUser);
  const controller = createAdminCatalogueController(supabase);
  const requireAdministrator = createRequireAdministrator(
    createAuthenticatedSupabaseClient,
  );
  const id = (name) =>
    param(name).isUUID().withMessage(`${name} must be a UUID`);
  const admin = [requireAdministrator];

  router.get("/catalogue", ...admin, controller.listCatalogue);

  router.post(
    "/collections",
    ...admin,
    textRule("name", 120, true),
    slugRule("slug"),
    textRule("description", 5000),
    body("coverImageUrl").optional({ values: "null" }).isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    }).withMessage("coverImageUrl must be an HTTP or HTTPS URL"),
    optionalBoolean("isActive"),
    optionalSortOrder(),
    strictBody(["name", "slug", "description", "coverImageUrl", "isActive", "sortOrder"]),
    validateRequest,
    controller.createCollection,
  );
  router.put(
    "/collections/:collectionId",
    ...admin,
    id("collectionId"),
    nonEmptyBody(),
    textRule("name", 120),
    body("slug").optional().isString().trim().isLength({ min: 1, max: 120 })
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    textRule("description", 5000),
    body("coverImageUrl").optional({ values: "null" }).isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    }),
    optionalBoolean("isActive"),
    optionalSortOrder(),
    strictBody(["name", "slug", "description", "coverImageUrl", "isActive", "sortOrder"]),
    validateRequest,
    controller.updateCollection,
  );
  router.delete(
    "/collections/:collectionId",
    ...admin,
    id("collectionId"),
    validateRequest,
    controller.deactivateCollection,
  );

  router.post(
    "/products",
    ...admin,
    body("collectionId").isUUID().withMessage("collectionId must be a UUID"),
    textRule("name", 160, true),
    slugRule("slug"),
    textRule("description", 5000),
    optionalBoolean("isActive"),
    optionalBoolean("isFeatured"),
    optionalSortOrder(),
    strictBody([
      "collectionId", "name", "slug", "description", "isActive",
      "isFeatured", "sortOrder",
    ]),
    validateRequest,
    controller.createProduct,
  );
  router.put(
    "/products/:productId",
    ...admin,
    id("productId"),
    nonEmptyBody(),
    body("collectionId").optional().isUUID(),
    textRule("name", 160),
    body("slug").optional().isString().trim().isLength({ min: 1, max: 120 })
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    textRule("description", 5000),
    optionalBoolean("isActive"),
    optionalBoolean("isFeatured"),
    optionalSortOrder(),
    strictBody([
      "collectionId", "name", "slug", "description", "isActive",
      "isFeatured", "sortOrder",
    ]),
    validateRequest,
    controller.updateProduct,
  );
  router.delete(
    "/products/:productId",
    ...admin,
    id("productId"),
    validateRequest,
    controller.deactivateProduct,
  );

  router.post(
    "/products/:productId/images",
    ...admin,
    id("productId"),
    body("imageUrl").isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    }).withMessage("imageUrl must be an HTTP or HTTPS URL"),
    textRule("altText", 240),
    optionalSortOrder(),
    strictBody(["imageUrl", "altText", "sortOrder"]),
    validateRequest,
    controller.createImage,
  );
  router.put(
    "/products/:productId/images/:imageId",
    ...admin,
    id("productId"),
    id("imageId"),
    nonEmptyBody(),
    body("imageUrl").optional().isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    }),
    textRule("altText", 240),
    optionalSortOrder(),
    strictBody(["imageUrl", "altText", "sortOrder"]),
    validateRequest,
    controller.updateImage,
  );

  router.post(
    "/products/:productId/variants",
    ...admin,
    id("productId"),
    textRule("sku", 120, true),
    textRule("size", 80),
    textRule("color", 80),
    body("price").isFloat({ gt: 0 }).toFloat().withMessage("price must be greater than zero"),
    body("stock").isInt({ min: 0 }).toInt().withMessage("stock must be a non-negative integer"),
    optionalBoolean("isActive"),
    strictBody(["sku", "size", "color", "price", "stock", "isActive"]),
    validateRequest,
    controller.createVariant,
  );
  router.put(
    "/products/:productId/variants/:variantId",
    ...admin,
    id("productId"),
    id("variantId"),
    nonEmptyBody(),
    textRule("sku", 120),
    textRule("size", 80),
    textRule("color", 80),
    body("price").optional().isFloat({ gt: 0 }).toFloat(),
    body("stock").optional().isInt({ min: 0 }).toInt(),
    optionalBoolean("isActive"),
    strictBody(["sku", "size", "color", "price", "stock", "isActive"]),
    validateRequest,
    controller.updateVariant,
  );
  router.delete(
    "/products/:productId/variants/:variantId",
    ...admin,
    id("productId"),
    id("variantId"),
    validateRequest,
    controller.deactivateVariant,
  );

  router.get("/enquiries", ...admin, controller.listEnquiries);
  router.patch(
    "/enquiries/:enquiryId",
    ...admin,
    id("enquiryId"),
    body("status").isIn(["new", "contacted", "resolved"])
      .withMessage("status must be new, contacted, or resolved"),
    strictBody(["status"]),
    validateRequest,
    controller.updateEnquiryStatus,
  );

  return router;
}

module.exports = { createAdminCatalogueRoutes };
