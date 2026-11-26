const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getNavigationEntries,
} = require("../../collection-navigation");

test("featured category links remain visible when the API has no collections", () => {
  assert.deepEqual(
    getNavigationEntries([]).map(({ name, slug, collection }) => ({
      name,
      slug,
      collection,
    })),
    [
      { name: "Men's Kurtas", slug: "mens-kurtas", collection: null },
      { name: "Kids Ethnic", slug: "kids-ethnic-wear", collection: null },
      { name: "Fine Fabrics", slug: "fine-fabrics", collection: null },
    ],
  );
});

test("featured links use matching collection records and retain other collections", () => {
  const collections = [
    { name: "Men's Kurtas", slug: "mens-kurtas" },
    { name: "Kids Ethnic Wear", slug: "kids-ethnic-wear" },
    { name: "Fine Fabrics", slug: "fine-fabrics" },
    { name: "Festive Sarees", slug: "festive-sarees" },
  ];

  assert.deepEqual(
    getNavigationEntries(collections),
    [
      { name: "Men's Kurtas", slug: "mens-kurtas", collection: collections[0] },
      { name: "Kids Ethnic", slug: "kids-ethnic-wear", collection: collections[1] },
      { name: "Fine Fabrics", slug: "fine-fabrics", collection: collections[2] },
      { name: "Festive Sarees", slug: "festive-sarees", collection: collections[3] },
    ],
  );
});
