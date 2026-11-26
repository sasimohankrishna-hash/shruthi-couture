(function initializeCoutureCollectionNavigation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CoutureCollectionNavigation = api;
})(globalThis, function createCollectionNavigationModule() {
  const FEATURED_COLLECTIONS = [
    {
      name: "Men's Kurtas",
      slug: "mens-kurtas",
      keys: ["mens-kurtas", "men-kurtas", "mens-wear"],
    },
    {
      name: "Kids Ethnic",
      slug: "kids-ethnic-wear",
      keys: ["kids-ethnic", "kids-ethnic-wear", "kids-wear"],
    },
    {
      name: "Fine Fabrics",
      slug: "fine-fabrics",
      keys: ["fine-fabrics", "fabrics"],
    },
  ];

  function normalizeKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getNavigationEntries(collections) {
    const remaining = Array.isArray(collections) ? [...collections] : [];
    const featured = FEATURED_COLLECTIONS.map((item) => {
      const keys = [normalizeKey(item.name), ...item.keys];
      const index = remaining.findIndex((collection) => {
        const name = normalizeKey(collection.name);
        const slug = normalizeKey(collection.slug);
        return keys.includes(name) || keys.includes(slug);
      });
      const collection = index < 0 ? null : remaining.splice(index, 1)[0];
      return { name: item.name, slug: collection?.slug || item.slug, collection };
    });

    return featured.concat(
      remaining.map((collection) => ({
        name: collection.name,
        slug: collection.slug,
        collection,
      })),
    );
  }

  return { getNavigationEntries };
});
