(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.CoutureOrderTable = api;
})(globalThis, function () {
  const columns = Object.freeze([
    Object.freeze({ key: "orderId", label: "Order ID" }),
    Object.freeze({ key: "customerName", label: "Customer Name" }),
    Object.freeze({ key: "customerPhone", label: "Customer Phone" }),
    Object.freeze({ key: "productSummary", label: "Product Summary" }),
    Object.freeze({ key: "totalItems", label: "Total Items" }),
    Object.freeze({ key: "totalAmount", label: "Total Amount" }),
    Object.freeze({ key: "stockDeducted", label: "Stock Deducted" }),
    Object.freeze({ key: "orderDetails", label: "Order Details" }),
    Object.freeze({ key: "action", label: "Action" }),
  ]);

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function summarizeOrder(order, source) {
    const isDatabaseOrder = source === "database";
    const sourceItems = Array.isArray(order.items) ? order.items : [];
    const items = sourceItems.map((item) => {
      const quantity = numberOrNull(item.quantity);
      const productPrice = numberOrNull(
        isDatabaseOrder ? item.product_price : item.price,
      );
      const lineTotal = isDatabaseOrder
        ? numberOrNull(item.line_total)
        : productPrice !== null && quantity !== null
          ? productPrice * quantity
          : null;

      return {
        productName: String(
          isDatabaseOrder ? item.product_name || "" : item.title || "",
        ),
        quantity,
        productPrice,
        lineTotal,
        selectedSize: item.selected_size ?? null,
        selectedColor: item.selected_color ?? null,
      };
    });
    const productNames = [
      ...new Set(items.map((item) => item.productName).filter(Boolean)),
    ];
    const quantitiesAreValid = items.every(
      (item) => Number.isInteger(item.quantity) && item.quantity > 0,
    );

    return {
      isDatabaseOrder,
      orderId: isDatabaseOrder
        ? String(order.id || "")
        : `DEMO · ${String(order.reference || order.id || "")}`,
      databaseOrderId: isDatabaseOrder ? String(order.id || "") : null,
      localOrderId: isDatabaseOrder ? null : String(order.id || ""),
      customerName: String(
        isDatabaseOrder ? order.customer_name || "" : order.customerName || "",
      ),
      customerPhone: String(
        isDatabaseOrder ? order.customer_phone || "" : order.customerPhone || "",
      ),
      productSummary: productNames.join(", ") || "—",
      totalItems: quantitiesAreValid
        ? items.reduce((total, item) => total + item.quantity, 0)
        : null,
      totalAmount: numberOrNull(
        isDatabaseOrder ? order.total_amount : order.total,
      ),
      stockDeducted: isDatabaseOrder
        ? typeof order.stock_deducted === "boolean"
          ? order.stock_deducted
          : null
        : null,
      items,
      localStatus: String(order.status || "New"),
    };
  }

  return { columns, summarizeOrder };
});
