const express = require("express");
const { createCollectionController } = require("../controllers/collectionController");

function createCollectionRoutes(supabase) {
  const router = express.Router();
  const controller = createCollectionController(supabase);

  router.get("/", controller.list);
  router.get("/:collectionId", controller.getByIdentifier);

  return router;
}

module.exports = { createCollectionRoutes };
