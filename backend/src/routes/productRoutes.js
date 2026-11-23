const express = require("express");
const { query, param } = require("express-validator");
const { createProductController } = require("../controllers/productController");
const { validateRequest } = require("../middleware/validateRequest");
const { isUuid } = require("../controllers/collectionController");

function createProductRoutes(supabase) {
  const router = express.Router();
  const controller = createProductController(supabase);

  router.get(
    "/",
    query("search")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Search must be at most 100 characters"),
    query("collection")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Collection must be a valid ID or slug"),
    validateRequest,
    controller.list,
  );

  router.get(
    "/:productId",
    param("productId")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Product ID or slug is required")
      .custom((value) => !value.includes("/") && !value.includes(",")),
    validateRequest,
    controller.getByIdentifier,
  );

  return router;
}

function createCollectionProductRoutes(supabase) {
  const router = express.Router({ mergeParams: true });
  const controller = createProductController(supabase);

  router.get(
    "/",
    param("collectionId")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .custom((value) => !value.includes("/") && !value.includes(",")),
    validateRequest,
    controller.listByCollection,
  );

  return router;
}

module.exports = { createProductRoutes, createCollectionProductRoutes };
