const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const storeDataSource = fs.readFileSync(
  path.join(__dirname, "../../store-data.js"),
  "utf8",
);

function createStore(savedCart) {
  const storage = {
    getItem() {
      return JSON.stringify(savedCart);
    },
    setItem() {},
  };
  const context = { window: { localStorage: storage } };
  vm.runInNewContext(storeDataSource, context);
  return context.window.CoutureStore;
}

test("saved product-only cart items are accepted when price and stock are valid", () => {
  const store = createStore([
    {
      variantId: null,
      productId: "22222222-2222-4222-8222-222222222222",
      title: "Variantless dress",
      price: 1800,
      stock: 3,
      quantity: 2,
    },
  ]);
  const [item] = store.getCart();

  assert.equal(item.title, "Variantless dress");
  assert.equal(store.getCartItemKey(item), "product:22222222-2222-4222-8222-222222222222");
});

test("saved product-only cart items without valid price or stock are rejected", () => {
  const store = createStore([
    {
      variantId: null,
      productId: "22222222-2222-4222-8222-222222222222",
      title: "Unpriced dress",
      price: null,
      stock: 3,
      quantity: 1,
    },
    {
      variantId: null,
      productId: "33333333-3333-4333-8333-333333333333",
      title: "Unstocked dress",
      price: 1800,
      stock: null,
      quantity: 1,
    },
  ]);

  assert.equal(store.getCart().length, 0);
});
