(() => {
  const cartKey = "shruthis-couture.cart.v1";
  const variantUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function getCart() {
    const saved = window.localStorage.getItem(cartKey);
    if (saved === null) return [];

    let items;
    try {
      items = JSON.parse(saved);
    } catch (error) {
      throw new Error("Saved shopping bag data could not be read.", {
        cause: error,
      });
    }
    if (!Array.isArray(items)) {
      throw new Error("Saved shopping bag data has an invalid format.");
    }
    return items.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const hasVariant = variantUuid.test(item.variantId);
      const hasProduct = item.variantId === null && variantUuid.test(item.productId);
      const price = typeof item.price === "number" ? item.price : Number(item.price);
      return (
        (hasVariant || hasProduct) &&
        typeof item.title === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isInteger(item.stock) &&
        item.stock >= item.quantity &&
        Number.isFinite(price) &&
        price > 0
      );
    });
  }

  function getCartItemKey(item) {
    return item.variantId
      ? `variant:${item.variantId}`
      : `product:${item.productId}`;
  }

  function saveCart(items) {
    window.localStorage.setItem(cartKey, JSON.stringify(items));
  }

  function formatPrice(value) {
    const price =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    return Number.isFinite(price)
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(price)
      : "Price on request";
  }

  window.CoutureStore = Object.freeze({
    getCart,
    getCartItemKey,
    saveCart,
    formatPrice,
  });
})();
