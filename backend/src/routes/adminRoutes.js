const express = require("express");
const { createAdminController } = require("../controllers/adminController");
const {
  createRequireAuthenticatedUser,
} = require("../middleware/requireAuthenticatedUser");
const { createAdminCatalogueRoutes } = require("./adminCatalogueRoutes");
const { createCloudinaryUploadRoutes } = require("./cloudinaryUploadRoutes");
const { uploadImage: uploadImageToCloudinary } = require("../config/cloudinary");

function createAdminRoutes(
  supabase,
  createAuthenticatedSupabaseClient,
  uploadImage = uploadImageToCloudinary,
) {
  const router = express.Router();
  const controller = createAdminController(
    supabase,
    createAuthenticatedSupabaseClient,
  );
  const requireAuthenticatedUser = createRequireAuthenticatedUser(supabase);

  router.get("/session", requireAuthenticatedUser, controller.getSession);
  router.get("/orders", requireAuthenticatedUser, controller.listOrders);
  router.use(
    "/uploads/images",
    createCloudinaryUploadRoutes({
      requireAuthenticatedUser,
      createAuthenticatedSupabaseClient,
      uploadImage,
    }),
  );
  router.use(
    "/",
    createAdminCatalogueRoutes(
      supabase,
      createAuthenticatedSupabaseClient,
      requireAuthenticatedUser,
    ),
  );

  return router;
}

module.exports = { createAdminRoutes };
