const { randomUUID } = require("node:crypto");
const { ApiError } = require("../middleware/errorHandler");

const COLLECTION_FIELDS =
  "id,name,slug,description,cover_image_url,is_active,sort_order";
const PRODUCT_FIELDS =
  "id,collection_id,name,slug,description,price,stock,is_active,is_featured,sort_order";
const IMAGE_FIELDS =
  "id,product_id,image_url,alt_text,sort_order";
const VARIANT_FIELDS =
  "id,product_id,sku,size,color,price,stock,is_active";
const ENQUIRY_FIELDS =
  "id,customer_name,customer_phone,customer_email,message,status,created_at";

function trimmedOrNull(value) {
  return typeof value === "string" ? value.trim() || null : null;
}

function databaseError(message) {
  return new ApiError(502, message);
}

function slugBase(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "product";
}

async function createUniqueProductSlug(supabase, name) {
  const base = slugBase(name);
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw databaseError("Could not generate a unique product slug");
    if (!data) return slug;
  }
  throw new ApiError(409, "Could not generate a unique product slug");
}

async function createUniqueSku(supabase) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sku = `SC-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const { data, error } = await supabase
      .from("product_variants")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();
    if (error) throw databaseError("Could not generate a SKU");
    if (!data) return sku;
  }
  throw new ApiError(500, "Could not generate a unique SKU");
}

function createAdminCatalogueController(supabase) {
  async function listCatalogue(req, res, next) {
    try {
      const [collectionsResult, productsResult, imagesResult, variantsResult] =
        await Promise.all([
          supabase.from("collections").select(COLLECTION_FIELDS)
            .order("sort_order", { ascending: true }),
          supabase.from("products").select(PRODUCT_FIELDS)
            .order("sort_order", { ascending: true }),
          supabase.from("product_images").select(IMAGE_FIELDS)
            .order("sort_order", { ascending: true }),
          supabase.from("product_variants").select(VARIANT_FIELDS)
            .order("sku", { ascending: true }),
        ]);

      if (
        collectionsResult.error ||
        productsResult.error ||
        imagesResult.error ||
        variantsResult.error
      ) {
        throw databaseError("Could not retrieve the catalogue");
      }

      const imagesByProduct = new Map();
      for (const image of imagesResult.data || []) {
        const images = imagesByProduct.get(image.product_id) || [];
        images.push(image);
        imagesByProduct.set(image.product_id, images);
      }
      const variantsByProduct = new Map();
      for (const variant of variantsResult.data || []) {
        const variants = variantsByProduct.get(variant.product_id) || [];
        variants.push(variant);
        variantsByProduct.set(variant.product_id, variants);
      }

      const products = (productsResult.data || []).map((product) => ({
        ...product,
        images: imagesByProduct.get(product.id) || [],
        variants: variantsByProduct.get(product.id) || [],
      }));

      return res.json({
        success: true,
        message: "Catalogue retrieved successfully",
        data: { collections: collectionsResult.data || [], products },
      });
    } catch (error) {
      return next(error);
    }
  }

  async function createCollection(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("collections")
        .insert({
          name: req.body.name.trim(),
          slug: req.body.slug.trim(),
          description: req.body.description?.trim() || null,
          cover_image_url: req.body.coverImageUrl?.trim() || null,
          is_active: req.body.isActive ?? true,
          sort_order: req.body.sortOrder ?? 0,
        })
        .select(COLLECTION_FIELDS)
        .single();

      if (error) throw databaseError("Could not create collection");
      return res.status(201).json({
        success: true,
        message: "Collection created successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function updateCollection(req, res, next) {
    try {
      const fields = {};
      if (req.body.name !== undefined) fields.name = req.body.name.trim();
      if (req.body.slug !== undefined) fields.slug = req.body.slug.trim();
      if (req.body.description !== undefined) {
        fields.description = trimmedOrNull(req.body.description);
      }
      if (req.body.coverImageUrl !== undefined) {
        fields.cover_image_url = trimmedOrNull(req.body.coverImageUrl);
      }
      if (req.body.isActive !== undefined) fields.is_active = req.body.isActive;
      if (req.body.sortOrder !== undefined) fields.sort_order = req.body.sortOrder;

      const { data, error } = await supabase
        .from("collections")
        .update(fields)
        .eq("id", req.params.collectionId)
        .select(COLLECTION_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not update collection");
      if (!data) throw new ApiError(404, "Collection not found");
      return res.json({
        success: true,
        message: "Collection updated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function deactivateCollection(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("collections")
        .update({ is_active: false })
        .eq("id", req.params.collectionId)
        .select(COLLECTION_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not deactivate collection");
      if (!data) throw new ApiError(404, "Collection not found");
      return res.json({
        success: true,
        message: "Collection deactivated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function createProduct(req, res, next) {
    try {
      const slug = req.body.slug?.trim() ||
        await createUniqueProductSlug(supabase, req.body.name.trim());
      const { data, error } = await supabase
        .from("products")
        .insert({
          collection_id: req.body.collectionId,
          name: req.body.name.trim(),
          slug,
          description: req.body.description.trim(),
          price: req.body.price ?? null,
          stock: req.body.stock ?? null,
          is_active: req.body.isActive ?? true,
          is_featured: req.body.isFeatured ?? false,
          sort_order: req.body.sortOrder ?? 0,
        })
        .select(PRODUCT_FIELDS)
        .single();

      if (error) throw databaseError("Could not create product");
      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function updateProduct(req, res, next) {
    try {
      const fields = {};
      if (req.body.collectionId !== undefined) {
        fields.collection_id = req.body.collectionId;
      }
      if (req.body.name !== undefined) fields.name = req.body.name.trim();
      if (req.body.slug !== undefined) fields.slug = req.body.slug.trim();
      if (req.body.description !== undefined) {
        fields.description = trimmedOrNull(req.body.description);
      }
      if (Object.hasOwn(req.body, "price")) fields.price = req.body.price;
      if (Object.hasOwn(req.body, "stock")) fields.stock = req.body.stock;
      if (req.body.isActive !== undefined) fields.is_active = req.body.isActive;
      if (req.body.isFeatured !== undefined) {
        fields.is_featured = req.body.isFeatured;
      }
      if (req.body.sortOrder !== undefined) fields.sort_order = req.body.sortOrder;

      const { data, error } = await supabase
        .from("products")
        .update(fields)
        .eq("id", req.params.productId)
        .select(PRODUCT_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not update product");
      if (!data) throw new ApiError(404, "Product not found");
      return res.json({
        success: true,
        message: "Product updated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function deactivateProduct(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", req.params.productId)
        .select(PRODUCT_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not deactivate product");
      if (!data) throw new ApiError(404, "Product not found");
      return res.json({
        success: true,
        message: "Product deactivated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function createImage(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("product_images")
        .insert({
          product_id: req.params.productId,
          image_url: req.body.imageUrl,
          alt_text: req.body.altText?.trim() || null,
          sort_order: req.body.sortOrder ?? 0,
        })
        .select(IMAGE_FIELDS)
        .single();

      if (error) throw databaseError("Could not save product image");
      return res.status(201).json({
        success: true,
        message: "Product image saved successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function updateImage(req, res, next) {
    try {
      const fields = {};
      if (req.body.imageUrl !== undefined) fields.image_url = req.body.imageUrl;
      if (req.body.altText !== undefined) {
        fields.alt_text = trimmedOrNull(req.body.altText);
      }
      if (req.body.sortOrder !== undefined) fields.sort_order = req.body.sortOrder;

      const { data, error } = await supabase
        .from("product_images")
        .update(fields)
        .eq("id", req.params.imageId)
        .eq("product_id", req.params.productId)
        .select(IMAGE_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not update product image");
      if (!data) throw new ApiError(404, "Product image not found");
      return res.json({
        success: true,
        message: "Product image updated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function createVariant(req, res, next) {
    try {
      const sku = trimmedOrNull(req.body.sku) ||
        await createUniqueSku(supabase);
      const { data, error } = await supabase
        .from("product_variants")
        .insert({
          product_id: req.params.productId,
          sku,
          size: req.body.size?.trim() || null,
          color: req.body.color?.trim() || null,
          price: req.body.price ?? null,
          stock: req.body.stock ?? 0,
          is_active: req.body.isActive ?? true,
        })
        .select(VARIANT_FIELDS)
        .single();

      if (error) throw databaseError("Could not create product variant");
      return res.status(201).json({
        success: true,
        message: "Product variant created successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function updateVariant(req, res, next) {
    try {
      const fields = {};
      if (req.body.sku !== undefined) fields.sku = trimmedOrNull(req.body.sku);
      if (req.body.size !== undefined) {
        fields.size = trimmedOrNull(req.body.size);
      }
      if (req.body.color !== undefined) {
        fields.color = trimmedOrNull(req.body.color);
      }
      if (Object.hasOwn(req.body, "price")) fields.price = req.body.price;
      if (Object.hasOwn(req.body, "stock")) fields.stock = req.body.stock;
      if (req.body.isActive !== undefined) fields.is_active = req.body.isActive;

      const { data, error } = await supabase
        .from("product_variants")
        .update(fields)
        .eq("id", req.params.variantId)
        .eq("product_id", req.params.productId)
        .select(VARIANT_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not update product variant");
      if (!data) throw new ApiError(404, "Product variant not found");
      return res.json({
        success: true,
        message: "Product variant updated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function deactivateVariant(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .update({ is_active: false })
        .eq("id", req.params.variantId)
        .eq("product_id", req.params.productId)
        .select(VARIANT_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not deactivate product variant");
      if (!data) throw new ApiError(404, "Product variant not found");
      return res.json({
        success: true,
        message: "Product variant deactivated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async function listEnquiries(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("enquiries")
        .select(ENQUIRY_FIELDS)
        .order("created_at", { ascending: false });

      if (error) throw databaseError("Could not retrieve enquiries");
      return res.json({
        success: true,
        message: "Enquiries retrieved successfully",
        data: data || [],
      });
    } catch (error) {
      return next(error);
    }
  }

  async function updateEnquiryStatus(req, res, next) {
    try {
      const { data, error } = await supabase
        .from("enquiries")
        .update({ status: req.body.status })
        .eq("id", req.params.enquiryId)
        .select(ENQUIRY_FIELDS)
        .maybeSingle();

      if (error) throw databaseError("Could not update enquiry status");
      if (!data) throw new ApiError(404, "Enquiry not found");
      return res.json({
        success: true,
        message: "Enquiry status updated successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  return {
    listCatalogue,
    createCollection,
    updateCollection,
    deactivateCollection,
    createProduct,
    updateProduct,
    deactivateProduct,
    createImage,
    updateImage,
    createVariant,
    updateVariant,
    deactivateVariant,
    listEnquiries,
    updateEnquiryStatus,
  };
}

module.exports = { createAdminCatalogueController };
