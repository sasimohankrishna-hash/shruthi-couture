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
    return items.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        variantUuid.test(item.variantId) &&
        typeof item.title === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isInteger(item.stock) &&
        item.stock >= item.quantity,
    );
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

  window.CoutureStore = Object.freeze({ getCart, saveCart, formatPrice });
})();
