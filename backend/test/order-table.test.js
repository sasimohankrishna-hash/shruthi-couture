const test = require("node:test");
const assert = require("node:assert/strict");
const { columns, summarizeOrder } = require("../../admin-order-table");

test("Orders table exposes the confirmed nine columns in order", () => {
  assert.deepEqual(
    columns.map(({ label }) => label),
    [
      "Order ID",
      "Customer Name",
      "Customer Phone",
      "Product Summary",
      "Total Items",
      "Total Amount",
      "Stock Deducted",
      "Order Details",
      "Action",
    ],
  );
});

test("database order summary aggregates quantities and preserves snapshots", () => {
  const order = summarizeOrder(
    {
      id: "order-1",
      customer_name: "Customer",
      customer_phone: "123456789",
      total_amount: "4250.00",
      stock_deducted: false,
      items: [
        {
          product_id: null,
          variant_id: null,
          product_name: "Silk Kurta",
          selected_size: "S",
          selected_color: "Red",
          quantity: 1,
          product_price: "2500.00",
          line_total: "2500.00",
        },
        {
          product_id: null,
          variant_id: null,
          product_name: "Cotton Dupatta",
          selected_size: null,
          selected_color: null,
          quantity: 1,
          product_price: "1750.00",
          line_total: "1750.00",
        },
      ],
    },
    "database",
  );

  assert.equal(order.productSummary, "Silk Kurta, Cotton Dupatta");
  assert.equal(order.totalItems, 2);
  assert.equal(order.totalAmount, 4250);
  assert.equal(order.stockDeducted, false);
  assert.equal(order.items[0].productPrice, 2500);
  assert.equal(order.items[0].lineTotal, 2500);
  assert.equal(order.items[1].selectedSize, null);
  assert.equal(order.items[1].selectedColor, null);
});

test("local demo orders remain editable and never claim database stock state", () => {
  const order = summarizeOrder(
    {
      id: "local-1",
      reference: "SC-1001",
      customerName: "Demo Customer",
      customerPhone: "123456789",
      total: 500,
      status: "Confirmed",
      items: [{ title: "Demo Product", quantity: 2, price: 250 }],
    },
    "demo",
  );

  assert.equal(order.orderId, "DEMO · SC-1001");
  assert.equal(order.totalItems, 2);
  assert.equal(order.totalAmount, 500);
  assert.equal(order.stockDeducted, null);
  assert.equal(order.localStatus, "Confirmed");
  assert.equal(order.items[0].lineTotal, 500);
});

test("invalid item quantities are not presented as a valid item total", () => {
  const order = summarizeOrder(
    {
      id: "order-2",
      items: [{ product_name: "Product", quantity: 0 }],
    },
    "database",
  );

  assert.equal(order.totalItems, null);
});
