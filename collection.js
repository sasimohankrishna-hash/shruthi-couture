const store = window.CoutureStore;
const api = window.CoutureApi;
const productsGrid = document.querySelector("#products-grid");
const productsAnnouncement = document.querySelector("#products-announcement");
const bagCount = document.querySelector("#collection-bag-count");
let productData = [];
const productPlaceholder =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 720"><rect width="640" height="720" fill="#e8dfd1"/><path d="M170 500h300l-25-205H195z" fill="#f8f5ee" stroke="#8c7355" stroke-width="8"/><path d="M250 295c0-95 140-95 140 0" fill="none" stroke="#8c7355" stroke-width="10"/><path d="M270 390h100" stroke="#d8bc7c" stroke-width="8"/></svg>')}`;

if (window.lucide) window.lucide.createIcons();

function showProductsMessage(message, isError = false) {
  productsAnnouncement.textContent = message;
  productsAnnouncement.classList.toggle("is-error", isError);
}

function updateBagCount() {
  const count = store.getCart().reduce((total, item) => total + item.quantity, 0);
  bagCount.textContent = String(count);
  bagCount.setAttribute(
    "aria-label",
    `Shopping bag, ${count} ${count === 1 ? "item" : "items"}`,
  );
}

function makeVariantLabel(variant) {
  const options = [variant.size, variant.color].filter(Boolean).join(" · ");
  const identifier = options || variant.sku || "Standard option";
  const stockLabel = Number.isInteger(variant.stock) && variant.stock > 0
    ? `${variant.stock} available`
    : variant.stock === null
      ? "Stock not set"
      : "Out of stock";
  return `${identifier} · ${store.formatPrice(variant.price)} · ${stockLabel}`;
}

function createProductCard(product, collection) {
  const card = document.createElement("article");
  card.className = "style-card";
  card.dataset.productId = product.id;

  const image = document.createElement("img");
  image.className = "style-image";
  image.src =
    product.images?.find((entry) => entry.image_url)?.image_url ||
    collection.cover_image_url ||
    productPlaceholder;
  image.alt = product.images?.[0]?.alt_text || product.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.src = productPlaceholder;
    image.alt = `${product.name} image placeholder`;
  }, { once: true });
  card.append(image);

  const copy = document.createElement("div");
  copy.className = "style-card-copy";
  const label = document.createElement("p");
  label.className = "style-number";
  label.textContent = collection.name;
  const title = document.createElement("h2");
  title.textContent = product.name;
  const description = document.createElement("p");
  description.textContent = product.description || "";
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const availableVariants = variants.filter(
    (variant) =>
      Number.isInteger(variant.stock) &&
      variant.stock > 0 &&
      Number.isFinite(Number(variant.price)) &&
      Number(variant.price) > 0,
  );

  let variantSelect = null;
  let variantLabel = null;
  let optionNote = null;
  if (variants.length > 0) {
    variantLabel = document.createElement("label");
    variantLabel.className = "variant-option-label";
    variantLabel.textContent = "Size, colour and price";
    variantSelect = document.createElement("select");
    variantSelect.className = "variant-option";

    variants.forEach((variant) => {
      const option = document.createElement("option");
      option.value = variant.id;
      option.textContent = makeVariantLabel(variant);
      option.disabled = !availableVariants.some((entry) => entry.id === variant.id);
      variantSelect.append(option);
    });
    if (availableVariants.length > 0) {
      variantSelect.value = availableVariants[0].id;
    }
    variantLabel.append(variantSelect);
  } else {
    optionNote = document.createElement("p");
    optionNote.className = "variant-option-label";
    optionNote.textContent = "No size or colour options configured";
  }

  const price = document.createElement("p");
  price.className = "style-price";
  const availability = document.createElement("p");
  availability.className = "product-stock-note";
  const selectedVariant = () =>
    variantSelect
      ? variants.find((variant) => variant.id === variantSelect.value)
      : null;
  const updateVariantPrice = () => {
    const variant = selectedVariant();
    if (variants.length === 0) {
      const productPriceIsValid =
        Number.isFinite(Number(product.price)) && Number(product.price) > 0;
      const productStockIsValid =
        Number.isInteger(product.stock) && product.stock > 0;
      price.textContent = productPriceIsValid
        ? store.formatPrice(product.price)
        : "Price on request";
      availability.textContent = product.stock == null
        ? "Stock is being updated"
        : product.stock < 1
          ? "Out of stock"
          : "";
      quantityInput.max = String(productStockIsValid ? product.stock : 1);
      addButton.disabled = !productPriceIsValid || !productStockIsValid;
      return;
    }

    price.textContent =
      variant && Number.isFinite(Number(variant.price)) && Number(variant.price) > 0
        ? store.formatPrice(variant.price)
        : variant?.price == null
          ? "Price on request"
          : "Currently unavailable";
    availability.textContent = "";
    quantityInput.max = String(variant?.stock > 0 ? variant.stock : 1);
    if (
      Number.isInteger(variant?.stock) &&
      variant.stock > 0 &&
      Number(quantityInput.value) > variant.stock
    ) {
      quantityInput.value = String(variant.stock);
    }
    addButton.disabled =
      !variant ||
      !availableVariants.some((entry) => entry.id === variant.id);
  };
  const quantityLabel = document.createElement("label");
  quantityLabel.className = "variant-option-label";
  quantityLabel.textContent = "Quantity";
  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.min = "1";
  quantityInput.step = "1";
  quantityInput.value = "1";
  quantityLabel.append(quantityInput);

  const actions = document.createElement("div");
  actions.className = "style-actions";
  const addButton = document.createElement("button");
  addButton.className = "add-to-cart";
  addButton.type = "button";
  addButton.dataset.addProduct = "";
  addButton.textContent = "Add to Bag";
  addButton.disabled = availableVariants.length === 0;
  if (variantSelect) {
    variantSelect.addEventListener("change", updateVariantPrice);
  }
  updateVariantPrice();

  actions.append(addButton);
  copy.append(label, title, description);
  if (optionNote) copy.append(optionNote);
  if (variantLabel) copy.append(variantLabel);
  copy.append(price, availability, quantityLabel, actions);
  card.append(copy);
  return card;
}

async function renderCollection() {
  const params = new URLSearchParams(window.location.search);
  const searchTerm = params.get("search");
  if (searchTerm !== null) {
    await renderSearchResults(searchTerm.trim());
    return;
  }

  const requestedId = params.get("collection");
  if (!requestedId) {
    showCollectionUnavailable("Collection not found");
    return;
  }

  productsGrid.replaceChildren();
  try {
    const [collection, products] = await Promise.all([
      api.getCollection(requestedId),
      api.getProductsByCollection(requestedId),
    ]);
    productData = products;

    document.title = `${collection.name} | Shruthi's Couture`;
    document.querySelector("#products-eyebrow").textContent =
      "THE COUTURE COLLECTION";
    document.querySelector("#products-title").textContent = collection.name;
    document.querySelector("#products-description").textContent =
      collection.description || "";
    if (products.length === 0) {
      const empty = document.createElement("p");
      empty.className = "collection-empty";
      empty.textContent = "There are no active products in this collection yet.";
      productsGrid.append(empty);
    } else {
      products.forEach((product) => {
        productsGrid.append(createProductCard(product, collection));
      });
    }
    updateBagCount();
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    showCollectionUnavailable(
      error.message || "This collection could not be loaded.",
    );
    showProductsMessage(`Collection data could not be loaded: ${error.message}`, true);
  }
}

async function renderSearchResults(searchTerm) {
  productsGrid.replaceChildren();
  if (!searchTerm) {
    showSearchUnavailable(
      "Enter a product name, size or colour to search.",
      "Search products",
    );
    return;
  }
  if (searchTerm.length > 100) {
    showSearchUnavailable(
      "Search terms must be 100 characters or fewer.",
      "Search unavailable",
    );
    return;
  }

  try {
    const [products, collections] = await Promise.all([
      api.searchProducts(searchTerm),
      api.getCollections(),
    ]);
    productData = products;
    const collectionsById = new Map(
      collections.map((collection) => [collection.id, collection]),
    );
    const missingCollection = products.find(
      (product) => !collectionsById.has(product.collection_id),
    );
    if (missingCollection) {
      throw new Error("A product’s collection could not be loaded.");
    }

    document.title = `Search: ${searchTerm} | Shruthi's Couture`;
    document.querySelector("#products-eyebrow").textContent = "SEARCH RESULTS";
    document.querySelector("#products-title").textContent =
      `Results for “${searchTerm}”`;
    document.querySelector("#products-description").textContent =
      products.length === 0
        ? "No products matched your search. Try another name, size or colour."
        : `${products.length} matching ${products.length === 1 ? "product" : "products"}.`;

    if (products.length === 0) {
      const empty = document.createElement("p");
      empty.className = "collection-empty";
      empty.textContent = "No products found. Try a different search.";
      productsGrid.append(empty);
    } else {
      products.forEach((product) => {
        productsGrid.append(
          createProductCard(product, collectionsById.get(product.collection_id)),
        );
      });
    }
    updateBagCount();
    showProductsMessage(
      products.length === 0
        ? `No products matched “${searchTerm}”.`
        : `${products.length} matching products loaded.`,
    );
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    productData = [];
    showSearchUnavailable(
      `Search could not be completed: ${error.message}`,
      "Search unavailable",
    );
    showProductsMessage(`Search could not be completed: ${error.message}`, true);
  }
}

function showSearchUnavailable(message, title) {
  document.title = `${title} | Shruthi's Couture`;
  document.querySelector("#products-eyebrow").textContent = "SEARCH";
  document.querySelector("#products-title").textContent = title;
  document.querySelector("#products-description").textContent = message;
  productsGrid.replaceChildren();
  showProductsMessage(message, true);
}

function showCollectionUnavailable(message) {
  document.querySelector("#products-title").textContent =
    message === "Collection not found" ? message : "Collection unavailable";
  document.querySelector("#products-description").textContent =
    message === "Collection not found"
      ? "This collection may have been removed. Return to the storefront to browse what’s available."
      : "We couldn’t load this collection. Please return to the storefront and try again.";
  productsGrid.replaceChildren();
}

productsGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-product]");
  if (!addButton) return;

  const card = addButton.closest(".style-card");
  const variant = card.querySelector(".variant-option");
  const quantityInput = card.querySelector('input[type="number"]');
  const product = productData.find((item) => item.id === card.dataset.productId);
  const selectedVariant = product?.variants.find(
    (entry) => entry.id === variant?.value,
  );
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
  const itemPrice = hasVariants ? Number(selectedVariant?.price) : Number(product?.price);
  const itemStock = hasVariants ? selectedVariant?.stock : product?.stock;
  const quantity = Number(quantityInput.value);
  if (
    !product ||
    (hasVariants && !selectedVariant) ||
    !Number.isFinite(itemPrice) ||
    itemPrice <= 0 ||
    !Number.isInteger(itemStock) ||
    itemStock < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > itemStock
  ) {
    showProductsMessage("Choose an available option and valid quantity.", true);
    return;
  }

  const cart = new Map(
    store.getCart().map((item) => [store.getCartItemKey(item), item]),
  );
  const cartItem = {
    variantId: selectedVariant?.id || null,
    productId: product.id,
    title: product.name,
    size: selectedVariant?.size || null,
    color: selectedVariant?.color || null,
    price: itemPrice,
    stock: itemStock,
    quantity: 0,
  };
  const cartItemKey = store.getCartItemKey(cartItem);
  const existing = cart.get(cartItemKey);
  const nextQuantity = (existing?.quantity || 0) + quantity;
  if (nextQuantity > itemStock) {
    showProductsMessage(
      `Only ${itemStock} of this option are currently available.`,
      true,
    );
    return;
  }
  cart.set(cartItemKey, { ...cartItem, quantity: nextQuantity });
  try {
    store.saveCart([...cart.values()]);
    updateBagCount();
    showProductsMessage(`${product.name} added to your bag.`);
  } catch (error) {
    showProductsMessage(`Your bag could not be updated: ${error.message}`, true);
  }
});

window.addEventListener("storage", (event) => {
  if (!event.key || event.key === "shruthis-couture.cart.v1") {
    updateBagCount();
  }
});

void renderCollection();
