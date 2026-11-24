const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp, parseAllowedOrigins } = require("../src/app");

test("CORS accepts exact HTTPS origins and local development origins only", () => {
  assert.deepEqual(
    parseAllowedOrigins("https://store.example, http://localhost:5500"),
    ["https://store.example", "http://localhost:5500"],
  );
  assert.throws(
    () => parseAllowedOrigins("http://store.example"),
    /must use HTTPS/,
  );
  assert.throws(
    () => parseAllowedOrigins("https://store.example/admin"),
    /without paths or queries/,
  );
});

const orderId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const variantId = "33333333-3333-4333-8333-333333333333";
const optionalVariantId = "88888888-8888-4888-8888-888888888888";
const inactiveVariantId = "77777777-7777-4777-8777-777777777777";

function createFakeSupabase() {
  const calls = {
    rpc: [],
    tableQueries: [],
    verifiedTokens: [],
    authenticatedClientTokens: [],
    confirmationRpc: [],
    adminRpc: [],
  };
  const errors = {};
  const authentication = {
    result: { data: { user: null }, error: null },
  };
  const confirmation = {
    result: { data: null, error: null },
  };
  const adminAuthorization = {
    result: { data: true, error: null },
  };
  const tableColumns = {
    collections: new Set([
      "id",
      "name",
      "slug",
      "description",
      "cover_image_url",
      "is_active",
      "sort_order",
      "created_at",
      "updated_at",
    ]),
    products: new Set([
      "id",
      "collection_id",
      "slug",
      "name",
      "description",
      "is_active",
      "is_featured",
      "sort_order",
      "created_at",
      "updated_at",
    ]),
    product_images: new Set([
      "id",
      "product_id",
      "image_url",
      "cloudinary_public_id",
      "alt_text",
      "sort_order",
      "created_at",
    ]),
    product_variants: new Set([
      "id",
      "product_id",
      "sku",
      "size",
      "color",
      "price",
      "stock",
      "is_active",
      "created_at",
      "updated_at",
    ]),
    orders: new Set([
      "id",
      "customer_name",
      "customer_phone",
      "total_amount",
      "stock_deducted",
    ]),
    order_items: new Set([
      "id",
      "order_id",
      "product_id",
      "variant_id",
      "product_name",
      "selected_size",
      "selected_color",
      "quantity",
      "product_price",
      "line_total",
    ]),
    enquiries: new Set([
      "id",
      "customer_name",
      "customer_phone",
      "customer_email",
      "message",
      "status",
      "created_at",
    ]),
  };
  const rows = {
    collections: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "fabrics",
        name: "Fine Fabrics",
        description: "Fine fabrics for special occasions",
        cover_image_url: "https://example.com/fabrics.jpg",
        is_active: true,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ],
    products: [
      {
        id: productId,
        collection_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "silk-kurta",
        name: "Silk Kurta",
        description: "Test fixture",
        is_active: true,
        sort_order: 1,
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        collection_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "cotton-dupatta",
        name: "Cotton Dupatta",
        description: "Another product",
        is_active: true,
        sort_order: 2,
      },
    ],
    product_images: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        product_id: productId,
        image_url: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        cloudinary_public_id: "products/test",
        alt_text: "Silk Kurta",
        sort_order: 0,
      },
    ],
    product_variants: [
      {
        id: variantId,
        product_id: productId,
        sku: "SK-S-RED",
        size: "S",
        color: "Red",
        price: 2500,
        stock: 4,
        is_active: true,
      },
      {
        id: inactiveVariantId,
        product_id: productId,
        sku: "SK-M-BLUE",
        size: "M",
        color: "Blue",
        price: 2600,
        stock: 0,
        is_active: false,
      },
      {
        id: optionalVariantId,
        product_id: productId,
        sku: "JEWELRY-RED",
        size: null,
        color: null,
        price: 1750,
        stock: 3,
        is_active: true,
      },
    ],
    orders: [],
    order_items: [],
    enquiries: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.mode = "select";
      this.payload = null;
    }

    select(fields) {
      if (fields) {
        this.selectedFields = fields.split(",");
        const missingColumn = this.selectedFields.find(
          (field) => !tableColumns[this.table]?.has(field),
        );
        if (missingColumn) {
          this.selectError = {
            message: `column collections.${missingColumn} does not exist`,
            code: "42703",
          };
        }
      }
      return this;
    }

    eq(field, value) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    in(field, values) {
      this.filters.push((row) => values.includes(row[field]));
      return this;
    }

    or(expression) {
      const match = expression.match(
        /name\.ilike\."%([^%"]+)%"/,
      );
      this.searchTerm = match?.[1]?.toLowerCase();
      return this;
    }

    order(field) {
      if (field && !tableColumns[this.table]?.has(field)) {
        this.selectError = {
          message: `column ${this.table}.${field} does not exist`,
          code: "42703",
        };
      }
      return this;
    }

    insert(value) {
      this.mode = "insert";
      this.payload = value;
      return this;
    }

    update(value) {
      this.mode = "update";
      this.payload = value;
      return this;
    }

    single() {
      this.singleResult = true;
      return this;
    }

    maybeSingle() {
      this.singleResult = true;
      return this;
    }

    then(resolve, reject) {
      try {
        let result;
        if (this.selectError) {
          result = { data: null, error: this.selectError };
        } else if (errors[this.table]) {
          result = { data: null, error: errors[this.table] };
        } else if (this.mode === "insert") {
          const inserted = Array.isArray(this.payload)
            ? this.payload
            : [this.payload];
          const invalidColumn = inserted
            .flatMap((record) => Object.keys(record))
            .find((field) => !tableColumns[this.table]?.has(field));
          if (invalidColumn) {
            result = {
              data: null,
              error: {
                message: `column ${this.table}.${invalidColumn} does not exist`,
                code: "42703",
              },
            };
          } else {
            rows[this.table].push(...inserted);
            result = this.singleResult
              ? { data: inserted[0], error: null }
              : { data: inserted, error: null };
          }
        } else if (this.mode === "update") {
          const matches = rows[this.table].filter((row) =>
            this.filters.every((filter) => filter(row)),
          );
          matches.forEach((row) => Object.assign(row, this.payload));
          const selectedMatches = this.selectedFields
            ? matches.map((row) =>
                Object.fromEntries(
                  this.selectedFields.map((field) => [field, row[field]]),
                ),
              )
            : matches;
          result = this.singleResult
            ? { data: selectedMatches[0] || null, error: null }
            : { data: selectedMatches, error: null };
        } else {
          const matches = rows[this.table].filter(
            (row) =>
              this.filters.every((filter) => filter(row)) &&
              (!this.searchTerm ||
                `${row.name || ""} ${row.description || ""}`
                  .toLowerCase()
                  .includes(this.searchTerm)),
          );
          const selectedMatches =
            this.selectedFields
              ? matches.map((row) =>
                  Object.fromEntries(
                    this.selectedFields.map((field) => [field, row[field]]),
                  ),
                )
              : matches;
          result = this.singleResult
            ? { data: selectedMatches[0] || null, error: null }
            : { data: selectedMatches, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    }
  }

  const client = {
    auth: {
      async getUser(token) {
        calls.verifiedTokens.push(token);
        return authentication.result;
      },
    },
    from(table) {
      calls.tableQueries.push(table);
      return new Query(table);
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      let total = 0;
      const snapshots = [];
      for (const item of args.p_items) {
        const variant = rows.product_variants.find(
          (entry) => entry.id === item.variant_id,
        );
        const product = rows.products.find(
          (entry) => entry.id === variant?.product_id,
        );
        const collection = rows.collections.find(
          (entry) => entry.id === product?.collection_id,
        );
        if (
          !variant?.is_active ||
          !product?.is_active ||
          !collection?.is_active ||
          !Number.isFinite(variant.price) ||
          variant.price <= 0 ||
          variant.stock < 0 ||
          variant.stock < item.quantity
        ) {
          return {
            data: null,
            error: {
              message:
                variant?.price <= 0
                  ? "Product price must be positive"
                  : "A product is unavailable or stock is insufficient",
            },
          };
        }
        total += variant.price * item.quantity;
        snapshots.push({
          id: `item-${snapshots.length + 1}`,
          order_id: orderId,
          product_id: product.id,
          variant_id: variant.id,
          product_name: product.name,
          selected_size: variant.size,
          selected_color: variant.color,
          quantity: item.quantity,
          product_price: variant.price,
          line_total: variant.price * item.quantity,
        });
      }

      rows.orders.push({
        id: orderId,
        customer_name: args.p_customer_name,
        customer_phone: args.p_customer_phone,
        total_amount: total,
        stock_deducted: false,
      });
      rows.order_items.push(...snapshots);
      return { data: orderId, error: null };
    },
  };

  const authenticatedSupabaseClientFactory = (accessToken) => {
    calls.authenticatedClientTokens.push(accessToken);
    return {
      async rpc(name, args) {
        if (name === "is_admin") {
          calls.adminRpc.push({ name, args, accessToken });
          return adminAuthorization.result;
        }
        calls.confirmationRpc.push({ name, args, accessToken });
        return confirmation.result;
      },
    };
  };

  return {
    client,
    calls,
    rows,
    errors,
    authentication,
    confirmation,
    adminAuthorization,
    authenticatedSupabaseClientFactory,
  };
}

async function withServer(run) {
  const fake = createFakeSupabase();
  const app = createApp({
    supabase: fake.client,
    frontendUrl: "http://localhost:5500",
    authenticatedSupabaseClientFactory:
      fake.authenticatedSupabaseClientFactory,
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`, fake);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("health and active collection/product endpoints return success", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);

    const collections = await fetch(`${baseUrl}/api/collections`);
    assert.equal(collections.status, 200);
    const collectionsPayload = await collections.json();
    assert.equal(collectionsPayload.data[0].name, "Fine Fabrics");
    assert.equal(
      collectionsPayload.data[0].cover_image_url,
      "https://example.com/fabrics.jpg",
    );
    assert.equal(
      Object.hasOwn(collectionsPayload.data[0], "cover_image_secure_url"),
      false,
    );
    assert.equal(
      Object.hasOwn(collectionsPayload.data[0], "cover_image_public_id"),
      false,
    );
    assert.equal(
      Object.hasOwn(collectionsPayload.data[0], "cover_image_alt"),
      false,
    );

    const products = await fetch(`${baseUrl}/api/products?search=Silk`);
    assert.equal(products.status, 200);
    const payload = await products.json();
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].name, "Silk Kurta");
    assert.equal(payload.data[0].images.length, 1);
    assert.equal(
      payload.data[0].images[0].image_url,
      "https://res.cloudinary.com/demo/image/upload/test.jpg",
    );
    assert.equal(
      payload.data[0].images[0].cloudinary_public_id,
      "products/test",
    );
    assert.equal(payload.data[0].images[0].sort_order, 0);
    assert.equal(
      Object.hasOwn(payload.data[0].images[0], "secure_url"),
      false,
    );
    assert.equal(payload.data[0].variants[0].price, 2500);
    assert.equal(payload.data[0].variants[0].stock, 4);
    assert.equal(
      Object.hasOwn(payload.data[0].variants[0], "stock_quantity"),
      false,
    );
    assert.equal(payload.data[0].variants.length, 2);

    const productsByCollection = await fetch(
      `${baseUrl}/api/products?collection=fabrics`,
    );
    assert.equal(productsByCollection.status, 200);
    assert.equal((await productsByCollection.json()).data.length, 2);

    const product = await fetch(`${baseUrl}/api/products/silk-kurta`);
    assert.equal(product.status, 200);
    assert.equal((await product.json()).data.name, "Silk Kurta");

    const collectionWithProducts = await fetch(
      `${baseUrl}/api/collections?include=products`,
    );
    assert.equal(collectionWithProducts.status, 200);
    assert.equal(
      (await collectionWithProducts.json()).data[0].products.length,
      2,
    );
  });
});

test("collection query failures log sanitized Supabase details without exposing them", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.errors.collections = {
      message: "Invalid token=do-not-log",
      code: "42P01",
      details: "Authorization: Bearer do-not-log-either",
    };
    const originalConsoleError = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args);

    try {
      const response = await fetch(`${baseUrl}/api/collections`);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        success: false,
        message: "Something went wrong",
      });

      const diagnostic = logs.find(
        ([message]) => message === "Supabase query failed",
      );
      assert.ok(diagnostic);
      assert.deepEqual(diagnostic[1].error, {
        message: "Invalid token=[REDACTED]",
        code: "42P01",
        details: "Authorization: [REDACTED] [REDACTED]",
      });
      assert.equal(JSON.stringify(logs).includes("do-not-log"), false);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

test("collection detail and collection product routes resolve slugs", async () => {
  await withServer(async (baseUrl) => {
    const collection = await fetch(`${baseUrl}/api/collections/fabrics`);
    assert.equal(collection.status, 200);
    const collectionPayload = await collection.json();
    assert.equal(collectionPayload.data.name, "Fine Fabrics");
    assert.equal(
      collectionPayload.data.cover_image_url,
      "https://example.com/fabrics.jpg",
    );

    const products = await fetch(
      `${baseUrl}/api/collections/fabrics/products`,
    );
    assert.equal(products.status, 200);
    const payload = await products.json();
    assert.equal(payload.data.length, 2);
    assert.equal(payload.data[0].slug, "silk-kurta");
  });
});

test("invalid orders are rejected before calling the create_order RPC", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "123456789",
        items: [{ quantity: 1 }],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(fake.calls.rpc.length, 0);

    const invalidQuantities = [0, -1, 1.5, "2", null, 1001];
    for (const quantity of invalidQuantities) {
      const invalid = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Customer",
          customerPhone: "+919999999999",
          items: [{ variantId, quantity }],
        }),
      });
      assert.equal(invalid.status, 400, `quantity ${quantity} should be rejected`);
    }

    const inactive = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [{ variantId: inactiveVariantId, quantity: 1 }],
      }),
    });
    assert.equal(inactive.status, 409);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("unknown variant IDs are rejected before calling create_order", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [
          {
            variantId: "99999999-9999-4999-8999-999999999999",
            quantity: 1,
          },
        ],
      }),
    });

    assert.equal(response.status, 409);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("duplicate variant IDs are rejected before calling create_order", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [
          { variantId, quantity: 1 },
          { variantId: variantId.toUpperCase(), quantity: 1 },
        ],
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("order requests reject more than 50 line items", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: Array.from({ length: 51 }, (_, index) => ({
          variantId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          quantity: 1,
        })),
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("valid order uses database prices and leaves stock unchanged", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [{ variantId, quantity: 2 }],
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.data.id, orderId);
    assert.equal(payload.data.total_amount, 5000);
    assert.equal(payload.data.items[0].selected_size, "S");
    assert.equal(payload.data.items[0].selected_color, "Red");
    assert.equal(payload.data.items[0].product_name, "Silk Kurta");
    assert.equal(payload.data.items[0].product_id, productId);
    assert.equal(payload.data.items[0].variant_id, variantId);
    assert.equal(payload.data.items[0].product_price, 2500);
    assert.equal(payload.data.items[0].line_total, 5000);
    assert.equal(
      Object.hasOwn(payload.data.items[0], "product_name_snapshot"),
      false,
    );
    assert.equal(Object.hasOwn(payload.data.items[0], "unit_price"), false);
    assert.equal(payload.data.items[0].quantity, 2);
    assert.equal(fake.calls.rpc.length, 1);
    assert.deepEqual(fake.calls.rpc[0].args.p_items, [
      { variant_id: variantId, quantity: 2 },
    ]);
    assert.equal(Object.hasOwn(fake.calls.rpc[0].args.p_items[0], "price"), false);
    assert.equal(fake.rows.product_variants[0].stock, 4);
  });
});

test("order accepts a quantity of 1000 when mock inventory permits it", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.rows.product_variants[0].stock = 1000;
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [{ variantId, quantity: 1000 }],
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(fake.calls.rpc.length, 1);
    assert.equal(fake.rows.orders[0].total_amount, 2500000);
    assert.equal(fake.rows.product_variants[0].stock, 1000);
  });
});

test("order creation supports multiple product variants in one request", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [
          { variantId, quantity: 1 },
          { variantId: optionalVariantId, quantity: 1 },
        ],
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.data.total_amount, 4250);
    assert.equal(payload.data.items.length, 2);
    assert.equal(fake.rows.product_variants[0].stock, 4);
    assert.equal(fake.rows.product_variants[2].stock, 3);
  });
});

test("mocked create_order rejects nonpositive prices and negative stock", async () => {
  for (const invalidVariant of [
    { price: 0 },
    { price: -1 },
    { stock: -1 },
  ]) {
    await withServer(async (baseUrl, fake) => {
      Object.assign(fake.rows.product_variants[0], invalidVariant);
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Customer",
          customerPhone: "+919999999999",
          items: [{ variantId, quantity: 1 }],
        }),
      });

      assert.equal(response.status, 409);
      assert.equal(fake.calls.rpc.length, 1);
      assert.equal(fake.rows.orders.length, 0);
    });
  }
});

test("order rejects an active variant with insufficient stock", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.rows.product_variants[0].stock = 0;
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [{ variantId, quantity: 1 }],
      }),
    });

    assert.equal(response.status, 409);
    assert.equal(fake.calls.rpc.length, 1);
    assert.equal(fake.rows.orders.length, 0);
    assert.equal(fake.rows.product_variants[0].stock, 0);
  });
});

test("order creation rejects inactive products and collections in the mocked RPC", async () => {
  for (const deactivate of [
    (fake) => {
      fake.rows.products[0].is_active = false;
    },
    (fake) => {
      fake.rows.collections[0].is_active = false;
    },
  ]) {
    await withServer(async (baseUrl, fake) => {
      deactivate(fake);
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Customer",
          customerPhone: "+919999999999",
          items: [{ variantId, quantity: 1 }],
        }),
      });

      assert.equal(response.status, 409);
      assert.equal(fake.calls.rpc.length, 1);
      assert.equal(fake.rows.orders.length, 0);
    });
  }
});

test("order accepts a variant with NULL size and colour and snapshots NULLs", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        items: [{ variantId: optionalVariantId, quantity: 1 }],
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.data.total_amount, 1750);
    assert.equal(payload.data.items[0].selected_size, null);
    assert.equal(payload.data.items[0].selected_color, null);
    assert.equal(fake.calls.rpc.length, 1);
  });
});

test("enquiries are saved with initial status new", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/enquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Customer",
        customerPhone: "+919999999999",
        message: "Please share more details",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(fake.rows.enquiries[0].status, "new");
    assert.deepEqual(Object.keys(fake.rows.enquiries[0]).sort(), [
      "customer_email",
      "customer_name",
      "customer_phone",
      "message",
      "status",
    ]);
  });
});

test("enquiries reject category and product/collection context instead of dropping it", async () => {
  await withServer(async (baseUrl, fake) => {
    for (const metadata of [
      { inquiryType: "custom_magam" },
      { collectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { productId },
    ]) {
      const response = await fetch(`${baseUrl}/api/enquiries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Customer",
          customerPhone: "+919999999999",
          message: "Please share more details",
          ...metadata,
        }),
      });

      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.match(payload.errors[0].message, /not supported by the current database schema/i);
    }

    assert.equal(fake.rows.enquiries.length, 0);
  });
});

test("order confirmation rejects a missing Bearer token", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(
      `${baseUrl}/api/orders/${orderId}/confirm`,
      { method: "POST" },
    );

    assert.equal(response.status, 401);
    assert.equal(fake.calls.verifiedTokens.length, 0);
    assert.equal(fake.calls.confirmationRpc.length, 0);
  });
});

test("order confirmation rejects an invalid or expired token", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: null },
      error: { status: 401, message: "Invalid or expired token" },
    };
    const response = await fetch(
      `${baseUrl}/api/orders/${orderId}/confirm`,
      {
        method: "POST",
        headers: { authorization: "Bearer expired-token" },
      },
    );

    assert.equal(response.status, 401);
    assert.deepEqual(fake.calls.verifiedTokens, ["expired-token"]);
    assert.equal(fake.calls.authenticatedClientTokens.length, 0);
    assert.equal(fake.calls.confirmationRpc.length, 0);
  });
});

test("order confirmation rejects a non-admin before invoking the confirmation RPC", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "non-admin-user" } },
      error: null,
    };
    fake.adminAuthorization.result = { data: false, error: null };
    const response = await fetch(
      `${baseUrl}/api/orders/${orderId}/confirm`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer non-admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "admin-user" }),
      },
    );

    assert.equal(response.status, 403);
    assert.deepEqual(fake.calls.verifiedTokens, ["non-admin-token"]);
    assert.deepEqual(fake.calls.authenticatedClientTokens, [
      "non-admin-token",
    ]);
    assert.deepEqual(fake.calls.adminRpc, [
      {
        name: "is_admin",
        args: undefined,
        accessToken: "non-admin-token",
      },
    ]);
    assert.equal(fake.calls.confirmationRpc.length, 0);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("authenticated admin confirmation uses the verified admin JWT for the RPC", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "admin-user" } },
      error: null,
    };
    const response = await fetch(
      `${baseUrl}/api/orders/${orderId}/confirm`,
      {
        method: "POST",
        headers: { authorization: "Bearer admin-access-token" },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: "Order confirmed successfully",
      data: null,
    });
    assert.deepEqual(fake.calls.verifiedTokens, ["admin-access-token"]);
    assert.deepEqual(fake.calls.authenticatedClientTokens, [
      "admin-access-token",
      "admin-access-token",
    ]);
    assert.deepEqual(fake.calls.adminRpc, [
      {
        name: "is_admin",
        args: undefined,
        accessToken: "admin-access-token",
      },
    ]);
    assert.deepEqual(fake.calls.confirmationRpc, [
      {
        name: "confirm_order",
        args: { p_order_id: orderId },
        accessToken: "admin-access-token",
      },
    ]);
    assert.equal(fake.calls.rpc.length, 0);
  });
});

test("catalogue admin APIs reject missing tokens and non-admins before table access", async () => {
  await withServer(async (baseUrl, fake) => {
    const missing = await fetch(`${baseUrl}/api/admin/catalogue`);
    assert.equal(missing.status, 401);
    assert.equal(fake.calls.tableQueries.length, 0);

    fake.authentication.result = {
      data: { user: { id: "customer-user" } },
      error: null,
    };
    fake.adminAuthorization.result = { data: false, error: null };
    const denied = await fetch(`${baseUrl}/api/admin/catalogue`, {
      headers: { authorization: "Bearer customer-token" },
    });
    assert.equal(denied.status, 403);
    assert.equal(fake.calls.tableQueries.length, 0);
    assert.deepEqual(fake.calls.adminRpc, [
      { name: "is_admin", args: undefined, accessToken: "customer-token" },
    ]);
  });
});

test("admin can create a collection with an empty optional cover image URL", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };

    const response = await fetch(`${baseUrl}/api/admin/collections`, {
      method: "POST",
      headers: {
        authorization: "Bearer owner-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Men's Kurtas",
        slug: "mens-kurtas",
        description: "",
        coverImageUrl: "",
        isActive: true,
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.data.name, "Men's Kurtas");
    assert.equal(payload.data.slug, "mens-kurtas");
    assert.equal(payload.data.cover_image_url, null);
    assert.equal(fake.rows.collections.at(-1).cover_image_url, null);
  });
});

test("admin product activation updates use an authenticated admin and existing product UUID", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    const response = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
      method: "PUT",
      headers: {
        authorization: "Bearer owner-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });

    assert.equal(response.status, 200);
    assert.equal(fake.rows.products[0].is_active, false);
    assert.equal(fake.rows.products[0].id, productId);
    assert.deepEqual(fake.calls.adminRpc, [
      { name: "is_admin", args: undefined, accessToken: "owner-token" },
    ]);
  });
});

test("admin catalogue reads include real image URLs and active and inactive variants", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    const response = await fetch(`${baseUrl}/api/admin/catalogue`, {
      headers: { authorization: "Bearer owner-token" },
    });

    assert.equal(response.status, 200);
    const catalogue = (await response.json()).data;
    const product = catalogue.products.find((item) => item.id === productId);
    assert.equal(catalogue.collections[0].slug, "fabrics");
    assert.equal(product.images[0].image_url, "https://res.cloudinary.com/demo/image/upload/test.jpg");
    assert.equal(product.variants.length, 3);
    assert.equal(
      product.variants.some((variant) => variant.is_active === false),
      true,
    );
    assert.equal(fake.calls.tableQueries.length, 4);
  });
});

test("deleting an admin product deactivates it without deleting the database record", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    const response = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer owner-token" },
    });

    assert.equal(response.status, 200);
    assert.equal(fake.rows.products.some((item) => item.id === productId), true);
    assert.equal(
      fake.rows.products.find((item) => item.id === productId).is_active,
      false,
    );
  });
});

test("admin product variant validation rejects negative price and unsupported fields", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    const response = await fetch(
      `${baseUrl}/api/admin/products/${productId}/variants`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sku: "SK-S-RED",
          size: "S",
          color: "Red",
          price: -1,
          stock: 2,
          productId,
        }),
      },
    );

    assert.equal(response.status, 400);
    assert.equal(fake.rows.product_variants.length, 3);
  });
});

test("admin enquiry status accepts only supported workflow values", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    const response = await fetch(
      `${baseUrl}/api/admin/enquiries/11111111-1111-4111-8111-111111111111`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "deleted" }),
      },
    );

    assert.equal(response.status, 400);
    assert.equal(fake.rows.enquiries.length, 0);
  });
});

test("authorized admin updates an existing enquiry using the supported status workflow", async () => {
  await withServer(async (baseUrl, fake) => {
    const enquiryId = "99999999-9999-4999-8999-999999999999";
    fake.authentication.result = {
      data: { user: { id: "owner-user" } },
      error: null,
    };
    fake.rows.enquiries.push({
      id: enquiryId,
      customer_name: "Customer",
      customer_phone: "+919999999999",
      customer_email: null,
      message: "Please share more details",
      status: "new",
      created_at: "2026-01-01T00:00:00Z",
    });
    const response = await fetch(
      `${baseUrl}/api/admin/enquiries/${enquiryId}`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "contacted" }),
      },
    );

    assert.equal(response.status, 200);
    assert.equal(fake.rows.enquiries[0].status, "contacted");
    assert.equal((await response.json()).data.id, enquiryId);
  });
});

test("admin session verification uses the verified user JWT and identity", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user", email: "owner@example.com" } },
      error: null,
    };
    const response = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { authorization: "Bearer owner-access-token" },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: "Administrator session verified",
      data: { isAdmin: true, email: "owner@example.com" },
    });
    assert.deepEqual(fake.calls.adminRpc, [
      {
        name: "is_admin",
        args: undefined,
        accessToken: "owner-access-token",
      },
    ]);
  });
});

test("admin session rejects non-admin users", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "customer-user", email: "customer@example.com" } },
      error: null,
    };
    fake.adminAuthorization.result = { data: false, error: null };
    const response = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { authorization: "Bearer customer-access-token" },
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).message, "Administrator access required");
    assert.deepEqual(fake.calls.adminRpc, [
      {
        name: "is_admin",
        args: undefined,
        accessToken: "customer-access-token",
      },
    ]);
  });
});

test("admin order listing rejects requests without an authenticated user", async () => {
  await withServer(async (baseUrl, fake) => {
    const response = await fetch(`${baseUrl}/api/admin/orders`);

    assert.equal(response.status, 401);
    assert.equal(fake.calls.verifiedTokens.length, 0);
    assert.equal(fake.calls.adminRpc.length, 0);
  });
});

test("admin order listing rejects authenticated non-admins", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "customer-user" } },
      error: null,
    };
    fake.adminAuthorization.result = { data: false, error: null };
    const response = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { authorization: "Bearer customer-access-token" },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(fake.calls.adminRpc, [
      {
        name: "is_admin",
        args: undefined,
        accessToken: "customer-access-token",
      },
    ]);
  });
});

test("admin order listing returns Supabase orders only after admin verification", async () => {
  await withServer(async (baseUrl, fake) => {
    fake.authentication.result = {
      data: { user: { id: "owner-user", email: "owner@example.com" } },
      error: null,
    };
    fake.rows.orders.push({
      id: orderId,
      customer_name: "Customer",
      customer_phone: "+919999999999",
      total_amount: 2500,
      stock_deducted: false,
    });
    fake.rows.order_items.push({
      id: "item-1",
      order_id: orderId,
      product_id: productId,
      variant_id: variantId,
      product_name: "Silk Kurta",
      selected_size: "S",
      selected_color: "Red",
      quantity: 1,
      product_price: 2500,
      line_total: 2500,
    });
    const response = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { authorization: "Bearer owner-access-token" },
    });

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, [
      {
        id: orderId,
        customer_name: "Customer",
        customer_phone: "+919999999999",
        total_amount: 2500,
        stock_deducted: false,
        items: [
          {
            id: "item-1",
            order_id: orderId,
            product_id: productId,
            variant_id: variantId,
            product_name: "Silk Kurta",
            selected_size: "S",
            selected_color: "Red",
            quantity: 1,
            product_price: 2500,
            line_total: 2500,
          },
        ],
      },
    ]);
    assert.equal(fake.calls.adminRpc.length, 1);
    assert.equal(fake.calls.adminRpc[0].accessToken, "owner-access-token");
  });
});

test("public order lookup is not exposed", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orders/${orderId}`);
    assert.equal(response.status, 404);
  });
});
