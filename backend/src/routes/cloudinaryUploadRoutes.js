const express = require("express");
const multer = require("multer");
const { ApiError } = require("../middleware/errorHandler");
const { createRequireAdministrator } = require("../middleware/requireAdministrator");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function getImageMimeType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function createCloudinaryUploadRoutes({
  requireAuthenticatedUser,
  createAuthenticatedSupabaseClient,
  uploadImage,
}) {
  const router = express.Router();
  const requireAdministrator = createRequireAdministrator(
    createAuthenticatedSupabaseClient,
  );
  const parseImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
    fileFilter(req, file, callback) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
          new ApiError(400, "Only JPEG, PNG, and WebP images are allowed"),
        );
      }
      return callback(null, true);
    },
  }).single("image");

  router.post("/", requireAuthenticatedUser, requireAdministrator, (req, res, next) => {
    parseImage(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(new ApiError(413, "Image must be 5 MB or smaller"));
        }
        return next(new ApiError(400, "Upload must contain one image in the image field"));
      }
      return next(error);
    });
  }, async (req, res, next) => {
    if (!req.file) {
      return next(new ApiError(400, "An image file is required"));
    }

    const detectedMimeType = getImageMimeType(req.file.buffer);
    if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
      return next(
        new ApiError(400, "File content must match a supported image type"),
      );
    }

    try {
      const result = await uploadImage(req.file.buffer);
      const imageUrl = new URL(result?.secure_url);
      if (imageUrl.protocol !== "https:") {
        throw new Error("Cloudinary did not return a secure image URL");
      }

      return res.status(201).json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          imageUrl: imageUrl.toString(),
          publicId: result.public_id,
        },
      });
    } catch (error) {
      console.error("Cloudinary image upload failed", {
        error: error?.name || "UnknownError",
      });
      return next(new ApiError(502, "Image upload failed"));
    }
  });

  return router;
}

module.exports = { createCloudinaryUploadRoutes };
