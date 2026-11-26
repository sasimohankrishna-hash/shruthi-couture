const { ApiError } = require("../middleware/errorHandler");

const COLLECTION_FIELDS =
  "id,slug,name,description,cover_image_url,is_active,sort_order";
const PRODUCT_FIELDS =
  "id,collection_id,slug,name,description,price,stock,is_active,sort_order";

function redactSensitiveText(value) {
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(
      /(\b(?:api[\s_-]?key|password|passwd|secret|token|authorization)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\b(sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/gi, "$1[REDACTED]")
    .replace(
      /(\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi,
      "$1[REDACTED]@",
    );
}

function logSupabaseError(error, req, operation) {
  const diagnostic = {};
  for (const field of ["message", "code", "details"]) {
    const value = error && error[field];
    if (typeof value === "string" || typeof value === "number") {
      diagnostic[field] =
        typeof value === "string" ? redactSensitiveText(value) : value;
    }
  }

  console.error("Supabase query failed", {
    method: req.method,
    path: req.path,
    operation,
    error: diagnostic,
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function findCollection(supabase, identifier, req) {
  const column = isUuid(identifier) ? "id" : "slug";
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_FIELDS)
    .eq(column, identifier)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logSupabaseError(error, req, "retrieve collection");
    throw new ApiError(502, "Could not retrieve collections");
  }
  return data;
}

function createCollectionController(supabase) {
  async function list(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select(COLLECTION_FIELDS)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        logSupabaseError(error, req, "list collections");
        throw new ApiError(502, "Could not retrieve collections");
      }

      let collections = data || [];
      if (req.query.include === "products" && collections.length > 0) {
        const collectionIds = collections.map((item) => item.id);
        const { data: products, error: productError } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .in("collection_id", collectionIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (productError) {
          logSupabaseError(productError, req, "retrieve collection products");
          throw new ApiError(502, "Could not retrieve collection products");
        }

        const productsByCollection = new Map(
          collections.map((item) => [item.id, []]),
        );
        for (const product of products || []) {
          productsByCollection.get(product.collection_id)?.push(product);
        }
        collections = collections.map((item) => ({
          ...item,
          products: productsByCollection.get(item.id),
        }));
      }

      return res.json({
        success: true,
        message: "Collections retrieved successfully",
        data: collections,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function getByIdentifier(req, res, next) {
    try {
      const collection = await findCollection(
        supabase,
        req.params.collectionId,
        req,
      );
      if (!collection) throw new ApiError(404, "Collection not found");

      return res.json({
        success: true,
        message: "Collection retrieved successfully",
        data: collection,
      });
    } catch (error) {
      return next(error);
    }
  }

  return { list, getByIdentifier };
}

module.exports = { createCollectionController, findCollection, isUuid };
