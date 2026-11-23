const { ApiError } = require("../middleware/errorHandler");
const { findCollection, isUuid } = require("./collectionController");

const PRODUCT_FIELDS =
  "id,collection_id,slug,name,description,is_active,sort_order";
const IMAGE_FIELDS =
  "id,product_id,image_url,cloudinary_public_id,alt_text,sort_order";
const VARIANT_FIELDS =
  "id,product_id,sku,size,color,price,stock,is_active";

function escapeLike(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_]/g, "\\$&");
}

async function getActiveCollectionIds(supabase) {
  const { data, error } = await supabase
    .from("collections")
    .select("id")
    .eq("is_active", true);

  if (error) throw new ApiError(502, "Could not retrieve collections");
  return (data || []).map((collection) => collection.id);
}

async function loadProductDetails(supabase, products) {
  if (products.length === 0) return [];

  const productIds = products.map((product) => product.id);
  const [imagesResult, variantsResult] = await Promise.all([
    supabase
      .from("product_images")
      .select(IMAGE_FIELDS)
      .in("product_id", productIds)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_variants")
      .select(VARIANT_FIELDS)
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("size", { ascending: true })
      .order("color", { ascending: true }),
  ]);

  if (imagesResult.error || variantsResult.error) {
    throw new ApiError(502, "Could not retrieve product details");
  }

  const imagesByProduct = new Map(productIds.map((id) => [id, []]));
  const variantsByProduct = new Map(productIds.map((id) => [id, []]));

  for (const image of imagesResult.data || []) {
    imagesByProduct.get(image.product_id)?.push(image);
  }
  for (const variant of variantsResult.data || []) {
    variantsByProduct.get(variant.product_id)?.push(variant);
  }

  return products.map((product) => ({
    ...product,
    images: imagesByProduct.get(product.id),
    variants: variantsByProduct.get(product.id),
  }));
}

function createProductController(supabase) {
  async function list(req, res, next) {
    try {
      let query = supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (req.query.collection) {
        const collection = await findCollection(
          supabase,
          req.query.collection,
          req,
        );
        if (!collection) {
          return res.json({
            success: true,
            message: "Products retrieved successfully",
            data: [],
          });
        }
        query = query.eq("collection_id", collection.id);
      } else {
        const collectionIds = await getActiveCollectionIds(supabase);
        if (collectionIds.length === 0) {
          return res.json({
            success: true,
            message: "Products retrieved successfully",
            data: [],
          });
        }
        query = query.in("collection_id", collectionIds);
      }

      const search = typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";
      if (search) {
        const pattern = `"%${escapeLike(search)}%"`;
        query = query.or(
          `name.ilike.${pattern},description.ilike.${pattern}`,
        );
      }

      const { data, error } = await query;
      if (error) throw new ApiError(502, "Could not retrieve products");

      const products = await loadProductDetails(supabase, data || []);
      return res.json({
        success: true,
        message: "Products retrieved successfully",
        data: products,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function getByIdentifier(req, res, next) {
    try {
      const column = isUuid(req.params.productId) ? "id" : "slug";
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq(column, req.params.productId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw new ApiError(502, "Could not retrieve product");
      if (!data) throw new ApiError(404, "Product not found");

      const activeCollectionIds = await getActiveCollectionIds(supabase);
      if (!activeCollectionIds.includes(data.collection_id)) {
        throw new ApiError(404, "Product not found");
      }

      const [product] = await loadProductDetails(supabase, [data]);
      return res.json({
        success: true,
        message: "Product retrieved successfully",
        data: product,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function listByCollection(req, res, next) {
    try {
      const collection = await findCollection(
        supabase,
        req.params.collectionId,
        req,
      );
      if (!collection) throw new ApiError(404, "Collection not found");

      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("collection_id", collection.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new ApiError(502, "Could not retrieve products");

      const products = await loadProductDetails(supabase, data || []);
      return res.json({
        success: true,
        message: "Products retrieved successfully",
        data: products,
      });
    } catch (error) {
      return next(error);
    }
  }

  return { list, getByIdentifier, listByCollection };
}

module.exports = { createProductController, loadProductDetails };
