const store = window.CoutureStore;
const api = window.CoutureApi;
const menuButton = document.querySelector(".menu-toggle");
const mobileNavigation = document.querySelector("#mobile-nav");
const desktopCollectionLinks = document.querySelector("#desktop-collection-links");
const mobileCollectionLinks = document.querySelector("#mobile-collection-links");
const mobileCategoryLinks = document.querySelector("#mobile-category-links");
const collectionGrid = document.querySelector("#collection-grid");
const searchButton = document.querySelector("#search-toggle");
const searchDialog = document.querySelector("#search-dialog");
const searchForm = document.querySelector("#product-search-form");
const searchInput = document.querySelector("#product-search-input");
const searchFeedback = document.querySelector("#product-search-feedback");
const cartButton = document.querySelector(".cart-toggle");
const cartDialog = document.querySelector("#cart-dialog");
const cartItemsElement = document.querySelector("#cart-items");
const cartEmptyMessage = document.querySelector("#cart-empty");
const cartCount = document.querySelector("#cart-count");
const cartAnnouncement = document.querySelector("#cart-announcement");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutResult = document.querySelector("#checkout-result");
const orderButton = document.querySelector("#cart-whatsapp");
const enquiryForm = document.querySelector("#customer-enquiry-form");
const enquiryFeedback = document.querySelector("#enquiry-feedback");
const cart = new Map(store.getCart().map((item) => [item.variantId, item]));
let checkoutSubmitting = false;

if (window.lucide) window.lucide.createIcons();

function announce(message, isError = false) {
  cartAnnouncement.textContent = message;
  cartAnnouncement.classList.toggle("is-error", isError);
}

function saveCart() {
  store.saveCart([...cart.values()]);
}

function updateCurrentNavigation() {
  const currentHash = window.location.hash || "#home";
  document
    .querySelectorAll(".desktop-nav a, .mobile-nav a")
    .forEach((link) => {
      const isCurrent = link.getAttribute("href") === currentHash;
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      if (link.classList.contains("nav-link")) {
        link.classList.toggle("active", isCurrent);
      }
    });
}

function createCollectionNavigation(collections) {
  desktopCollectionLinks.replaceChildren();
  mobileCollectionLinks.replaceChildren();
  mobileCategoryLinks.replaceChildren();

  collections.forEach((collection) => {
    const collectionUrl =
      `collection.html?collection=${encodeURIComponent(collection.slug)}`;
    const desktopLink = document.createElement("a");
    desktopLink.className = "nav-link";
    desktopLink.href = collectionUrl;
    desktopLink.textContent = collection.name;
    desktopLink.target = "_blank";
    desktopLink.rel = "noopener noreferrer";
    desktopCollectionLinks.append(desktopLink);

    const mobileLink = document.createElement("a");
    mobileLink.href = collectionUrl;
    mobileLink.textContent = collection.name;
    mobileLink.target = "_blank";
    mobileLink.rel = "noopener noreferrer";
    mobileCollectionLinks.append(mobileLink);

    const mobileCategoryLink = document.createElement("a");
    mobileCategoryLink.className = "mobile-category-link";
    mobileCategoryLink.href = collectionUrl;
    mobileCategoryLink.textContent = collection.name;
    mobileCategoryLink.target = "_blank";
    mobileCategoryLink.rel = "noopener noreferrer";
    mobileCategoryLinks.append(mobileCategoryLink);
  });
}

function createCollectionCard(collection) {
  const card = document.createElement("article");
  card.className = "collection-card";
  card.id = collection.slug;

  const collectionUrl =
    `collection.html?collection=${encodeURIComponent(collection.slug)}`;
  const imageLink = document.createElement("a");
  imageLink.className = "collection-image-link";
  imageLink.href = collectionUrl;
  imageLink.target = "_blank";
  imageLink.rel = "noopener noreferrer";
  imageLink.setAttribute("aria-label", `${collection.name} collection`);
  if (collection.cover_image_url) {
    const image = document.createElement("img");
    image.src = collection.cover_image_url;
    image.alt = collection.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.classList.add("image-unavailable");
      image.alt = `${collection.name} image could not be loaded`;
    });
    imageLink.append(image);
  }

  const copy = document.createElement("div");
  copy.className = "collection-copy";
  const eyebrow = document.createElement("p");
  eyebrow.className = "collection-index";
  eyebrow.textContent = "THE COUTURE COLLECTION";
  const title = document.createElement("h3");
  title.textContent = collection.name;
  const description = document.createElement("p");
  description.textContent = collection.description || "";
  const actions = document.createElement("div");
  actions.className = "collection-actions";
  const browseLink = document.createElement("a");
  browseLink.className = "add-to-cart";
  browseLink.href = collectionUrl;
  browseLink.target = "_blank";
  browseLink.rel = "noopener noreferrer";
  browseLink.textContent = "Browse products";

  actions.append(browseLink);
  copy.append(eyebrow, title, description, actions);
  card.append(imageLink, copy);
  return card;
}

function renderCollections(collections) {
  collectionGrid.replaceChildren();
  createCollectionNavigation(collections);
  if (collections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "collection-empty";
    empty.textContent = "Our new collections are coming soon.";
    collectionGrid.append(empty);
  } else {
    collections.forEach((collection) => {
      collectionGrid.append(createCollectionCard(collection));
    });
  }
  updateCurrentNavigation();
  if (window.lucide) window.lucide.createIcons();
}

function renderCart() {
  const entries = [...cart.values()];
  const totalItems = entries.reduce((total, item) => total + item.quantity, 0);

  cartCount.textContent = String(totalItems);
  cartCount.hidden = totalItems === 0;
  cartButton.setAttribute(
    "aria-label",
    `Shopping bag, ${totalItems} ${totalItems === 1 ? "item" : "items"}`,
  );
  cartEmptyMessage.hidden = entries.length > 0;
  checkoutForm.hidden = entries.length === 0;
  orderButton.disabled = entries.length === 0 || checkoutSubmitting;
  cartItemsElement.replaceChildren();

  entries.forEach((item) => {
    const row = document.createElement("li");
    const details = document.createElement("div");
    const title = document.createElement("p");
    const quantity = document.createElement("p");
    const removeButton = document.createElement("button");
    const options = [item.size, item.color].filter(Boolean).join(" · ");

    row.className = "cart-item";
    title.className = "cart-item-title";
    title.textContent = item.title;
    quantity.className = "cart-item-quantity";
    quantity.textContent = [
      options || "Standard option",
      `Quantity: ${item.quantity}`,
      `${store.formatPrice(item.price)} each`,
    ].join(" · ");
    removeButton.className = "cart-remove";
    removeButton.type = "button";
    removeButton.textContent = "Remove one";
    removeButton.dataset.cartRemove = item.variantId;
    removeButton.setAttribute(
      "aria-label",
      `Remove one ${item.title} from your bag`,
    );

    details.append(title, quantity);
    row.append(details, removeButton);
    cartItemsElement.append(row);
  });
}

function openCartFromUrl() {
  if (window.location.hash === "#bag" && !cartDialog.open) {
    cartDialog.showModal();
  }
}

cartButton.addEventListener("click", () => cartDialog.showModal());
document.querySelector("#cart-close").addEventListener("click", () => {
  cartDialog.close();
});

searchButton.addEventListener("click", () => {
  searchFeedback.hidden = true;
  searchFeedback.textContent = "";
  searchDialog.showModal();
  searchInput.focus();
});
document.querySelector("#search-close").addEventListener("click", () => {
  searchDialog.close();
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const searchTerm = searchInput.value.trim();
  if (!searchTerm) {
    searchFeedback.textContent = "Enter a product name, size or colour to search.";
    searchFeedback.hidden = false;
    searchInput.focus();
    return;
  }

  window.location.href = `collection.html?search=${encodeURIComponent(searchTerm)}`;
});

cartItemsElement.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-cart-remove]");
  if (!removeButton) return;
  const variantId = removeButton.dataset.cartRemove;
  const item = cart.get(variantId);
  if (!item) return;

  if (item.quantity === 1) cart.delete(variantId);
  else cart.set(variantId, { ...item, quantity: item.quantity - 1 });
  saveCart();
  renderCart();
  announce(`${item.title} quantity updated.`);
});

function showWhatsAppSuccess(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const message = [
    `Hello! I have placed order ${order.id}.`,
    `Name: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    "Items:",
    ...items.map((item) => {
      const options = [item.selected_size, item.selected_color]
        .filter(Boolean)
        .join(", ");
      const variant = options ? ` (${options})` : "";
      return `- ${item.product_name}${variant} × ${item.quantity}`;
    }),
    `Order total: ${store.formatPrice(order.total_amount)}.`,
  ].join("\n");
  const url = `https://wa.me/919346794749?text=${encodeURIComponent(message)}`;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Continue in WhatsApp";

  checkoutResult.replaceChildren(
    document.createTextNode(`Order ${order.id} created successfully. `),
    link,
  );
  checkoutResult.hidden = false;
  checkoutResult.classList.remove("is-error");
  const popup = window.open(url, "_blank");
  if (popup) popup.opener = null;
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (checkoutSubmitting || cart.size === 0) return;

  const customerName = document.querySelector("#customer-name").value.trim();
  const customerPhone = document.querySelector("#customer-phone").value.trim();
  if (!customerName || !/^[+0-9().\-\s]{7,25}$/.test(customerPhone)) {
    announce("Enter your name and a valid phone number to continue.", true);
    return;
  }
  const items = [...cart.values()];
  if (
    items.some(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000 ||
        item.quantity > item.stock,
    )
  ) {
    announce("A selected quantity exceeds available stock. Update your bag and try again.", true);
    return;
  }

  checkoutSubmitting = true;
  orderButton.disabled = true;
  orderButton.textContent = "Submitting order…";
  checkoutResult.textContent = "";
  checkoutResult.hidden = true;
  checkoutResult.classList.remove("is-error");
  announce("Submitting your order securely.");
  try {
    const order = await api.createOrder({
      customerName,
      customerPhone,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });
    if (
      typeof order?.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(order.id)
    ) {
      throw new Error(
        "The order response did not include an Order ID. Please contact the store before retrying.",
      );
    }

    cart.clear();
    saveCart();
    renderCart();
    checkoutForm.reset();
    showWhatsAppSuccess(order);
    announce(`Order ${order.id} created successfully.`);
  } catch (error) {
    checkoutResult.textContent = error.message;
    checkoutResult.hidden = false;
    checkoutResult.classList.add("is-error");
    announce(error.message, true);
  } finally {
    checkoutSubmitting = false;
    orderButton.textContent = "Place order & continue to WhatsApp";
    renderCart();
  }
});

enquiryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = document.querySelector("#enquiry-submit");
  const customerPhone = document.querySelector("#enquiry-phone").value.trim();
  if (!/^[+0-9().\-\s]{7,25}$/.test(customerPhone)) {
    enquiryFeedback.textContent = "Enter a valid phone number.";
    enquiryFeedback.classList.add("is-error");
    return;
  }

  submitButton.disabled = true;
  enquiryFeedback.textContent = "Sending your enquiry…";
  enquiryFeedback.classList.remove("is-error");
  try {
    await api.createEnquiry({
      customerName: document.querySelector("#enquiry-name").value.trim(),
      customerPhone,
      customerEmail: document.querySelector("#enquiry-email").value.trim(),
      message: document.querySelector("#enquiry-message").value.trim(),
    });
    enquiryForm.reset();
    enquiryFeedback.textContent = "Your enquiry was sent successfully.";
  } catch (error) {
    enquiryFeedback.textContent = error.message;
    enquiryFeedback.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
  }
});

menuButton.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isExpanded));
  menuButton.setAttribute(
    "aria-label",
    isExpanded ? "Open navigation menu" : "Close navigation menu",
  );
  mobileNavigation.hidden = isExpanded;

  const icon = menuButton.querySelector("[data-lucide]");
  icon.setAttribute("data-lucide", isExpanded ? "menu" : "x");
  if (window.lucide) window.lucide.createIcons();
});

mobileNavigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    mobileNavigation.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    const icon = menuButton.querySelector("[data-lucide]");
    icon.setAttribute("data-lucide", "menu");
    if (window.lucide) window.lucide.createIcons();
  }
});

window.addEventListener("hashchange", updateCurrentNavigation);
window.addEventListener("hashchange", openCartFromUrl);
window.addEventListener("storage", (event) => {
  if (!event.key || event.key === "shruthis-couture.cart.v1") {
    cart.clear();
    store.getCart().forEach((item) => cart.set(item.variantId, item));
    renderCart();
  }
});

renderCart();
openCartFromUrl();
api.getCollections()
  .then(renderCollections)
  .catch((error) => {
    renderCollections([]);
    collectionGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "collection-empty";
    message.textContent = `Collections could not be loaded: ${error.message}`;
    collectionGrid.append(message);
    announce("Catalogue is temporarily unavailable.", true);
  });
