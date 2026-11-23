const express = require("express");
const { body } = require("express-validator");
const { rateLimit } = require("express-rate-limit");
const { createEnquiryController } = require("../controllers/enquiryController");
const { validateRequest } = require("../middleware/validateRequest");

function createEnquiryLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many enquiries. Please try again later.",
    },
  });
}

function createEnquiryRoutes(supabase) {
  const router = express.Router();
  const controller = createEnquiryController(supabase);

  router.post(
    "/",
    createEnquiryLimiter(),
    body("customerName")
      .isString()
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage("Customer name is required and must be at most 120 characters"),
    body("customerPhone")
      .isString()
      .trim()
      .matches(/^[+0-9().\-\s]{7,25}$/)
      .withMessage("A valid customer phone number is required"),
    body("customerEmail")
      .optional({ values: "falsy" })
      .isEmail()
      .normalizeEmail()
      .withMessage("Enter a valid email address"),
    body("message")
      .isString()
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage("Message is required and must be at most 5000 characters"),
    body()
      .custom((value) => {
        const keys = Object.keys(value || {});
        if (
          keys.some((key) =>
            ["inquiryType", "collectionId", "productId"].includes(key),
          )
        ) {
          throw new Error(
            "Enquiry category and product or collection context are not supported by the current database schema",
          );
        }
        if (
          !keys.every((key) =>
            [
              "customerName",
              "customerPhone",
              "customerEmail",
              "message",
            ].includes(key),
          )
        ) {
          throw new Error("Request contains unsupported fields");
        }
        return true;
      }),
    validateRequest,
    controller.create,
  );

  return router;
}

module.exports = { createEnquiryRoutes };
