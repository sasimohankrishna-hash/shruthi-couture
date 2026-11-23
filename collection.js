const store = window.CoutureStore;
const api = window.CoutureApi;
const productsGrid = document.querySelector("#products-grid");
const productsAnnouncement = document.querySelector("#products-announcement");
const bagCount = document.querySelector("#collection-bag-count");
let productData = [];

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
  const stockLabel = variant.stock > 0
    ? `${variant.stock} available`
    : "Out of stock";
  return `${identifier} · ${store.formatPrice(Number(variant.price))} · ${stockLabel}`;
}

function createProductCard(product, collection) {
  const card = document.createElement("article");
  card.className = "style-card";

  const imageUrl =
    product.images?.find((image) => image.image_url)?.image_url ||
    collection.cover_image_url;
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "style-image";
    image.src = imageUrl;
    image.alt = product.images?.[0]?.alt_text || product.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.classList.add("image-unavailable");
      image.alt = `${product.name} image could not be loaded`;
    });
    card.append(image);
  }

  const copy = document.createElement("div");
  copy.className = "style-card-copy";
  const label = document.createElement("p");
  label.className = "style-number";
  label.textContent = collection.name;
  const title = document.createElement("h2");
  title.textContent = product.name;
  const description = document.createElement("p");
  description.textContent = product.description || "";
  const variantLabel = document.createElement("label");
  variantLabel.className = "variant-option-label";
  variantLabel.textContent = "Size, colour and price";
  const variantSelect = document.createElement("select");
  variantSelect.className = "variant-option";
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const availableVariants = variants.filter(
    (variant) => Number.isInteger(variant.stock) && variant.stock > 0,
  );

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

  const price = document.createElement("p");
  price.className = "style-price";
  const selectedVariant = () =>
    variants.find((variant) => variant.id === variantSelect.value);
  const updateVariantPrice = () => {
    const variant = selectedVariant();
    price.textContent = variant
      ? store.formatPrice(Number(variant.price))
      : "Currently unavailable";
    quantityInput.max = String(variant?.stock || 1);
    if (variant && Number(quantityInput.value) > variant.stock) {
      quantityInput.value = String(variant.stock);
    }
    addButton.disabled = !variant || variant.stock < 1;
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
  addButton.dataset.addVariant = "";
  addButton.textContent = "Add to Bag";
  addButton.disabled = availableVariants.length === 0;
  variantSelect.addEventListener("change", updateVariantPrice);
  updateVariantPrice();

  actions.append(addButton);
  copy.append(label, title, description, variantLabel, price, quantityLabel, actions);
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
  const addButton = event.target.closest("[data-add-variant]");
  if (!addButton) return;

  const card = addButton.closest(".style-card");
  const variant = card.querySelector(".variant-option");
  const quantityInput = card.querySelector('input[type="number"]');
  const product = productData.find((item) =>
    item.variants.some((entry) => entry.id === variant.value),
  );
  const selectedVariant = product?.variants.find(
    (entry) => entry.id === variant.value,
  );
  const quantity = Number(quantityInput.value);
  if (
    !product ||
    !selectedVariant ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > selectedVariant.stock
  ) {
    showProductsMessage("Choose an available option and valid quantity.", true);
    return;
  }

  const cart = new Map(
    store.getCart()
      .map((item) => [item.variantId, item]),
  );
  const existing = cart.get(selectedVariant.id);
  const nextQuantity = (existing?.quantity || 0) + quantity;
  if (nextQuantity > selectedVariant.stock) {
    showProductsMessage(
      `Only ${selectedVariant.stock} of this option are currently available.`,
      true,
    );
    return;
  }
  cart.set(selectedVariant.id, {
    variantId: selectedVariant.id,
    productId: product.id,
    title: product.name,
    size: selectedVariant.size,
    color: selectedVariant.color,
    price: Number(selectedVariant.price),
    stock: selectedVariant.stock,
    quantity: nextQuantity,
  });
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
