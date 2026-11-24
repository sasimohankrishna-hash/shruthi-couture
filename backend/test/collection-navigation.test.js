const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getNavigationEntries,
} = require("../../collection-navigation");

test("featured category links remain visible when the API has no collections", () => {
  assert.deepEqual(
    getNavigationEntries([]).map(({ name, collection }) => ({
      name,
      collection,
    })),
    [
      { name: "Men's Kurtas", collection: null },
      { name: "Kids Ethnic", collection: null },
      { name: "Fine Fabrics", collection: null },
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
      { name: "Men's Kurtas", collection: collections[0] },
      { name: "Kids Ethnic", collection: collections[1] },
      { name: "Fine Fabrics", collection: collections[2] },
      { name: "Festive Sarees", collection: collections[3] },
    ],
  );
});
