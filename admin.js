const feedback = document.querySelector("#admin-feedback");
const collectionForm = document.querySelector("#collection-form");
const productForm = document.querySelector("#product-form");
const variantForm = document.querySelector("#variant-form");
const catalogueList = document.querySelector("#catalogue-list");
const productList = document.querySelector("#product-list");
const productCollectionSelect = document.querySelector("#product-collection");
const productImageFileInput = document.querySelector("#product-image-file");
const productImageUploadProgress = document.querySelector(
  "#product-image-upload-progress",
);
const productImageUploadStatus = document.querySelector(
  "#product-image-upload-status",
);
const variantProductSelect = document.querySelector("#variant-product");
const ordersList = document.querySelector("#orders-list");
const ordersTable = document.querySelector("#orders-table");
const ordersTableHeader = document.querySelector("#orders-table-header");
const ordersTableBody = document.querySelector("#orders-table-body");
const ordersEmpty = document.querySelector("#orders-empty");
const enquiriesList = document.querySelector("#enquiries-list");
const orderTable = window.CoutureOrderTable;
const enquiryStatuses = ["new", "contacted", "resolved"];
const allowedProductImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const productPlaceholder =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 720"><rect width="640" height="720" fill="#e8dfd1"/><path d="M170 500h300l-25-205H195z" fill="#f8f5ee" stroke="#8c7355" stroke-width="8"/><path d="M250 295c0-95 140-95 140 0" fill="none" stroke="#8c7355" stroke-width="10"/><path d="M270 390h100" stroke="#d8bc7c" stroke-width="8"/></svg>')}`;
let collections = [];
let products = [];
let supabaseOrders = [];
let enquiries = [];
let productImageUploadInProgress = false;
const confirmationChecks = new Set();

if (window.lucide) window.lucide.createIcons();

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPrice(value) {
  const price = value === null || value === undefined || value === ""
    ? NaN
    : Number(value);
  return Number.isFinite(price) && price > 0
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(price)
    : "Price not set";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

async function request(path, options = {}) {
  const response = await window.CoutureAdminSession.request(path, options);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The backend returned an invalid response.");
  }
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.message || "The request could not be completed.");
  }
  return payload.data;
}

function jsonOptions(method, value) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

function showProductImageUploadStatus(message, isError = false) {
  productImageUploadStatus.textContent = message;
  productImageUploadStatus.classList.toggle("is-error", isError);
}

productImageFileInput.addEventListener("change", async () => {
  const file = productImageFileInput.files?.[0];
  if (!file) return;

  if (!allowedProductImageTypes.has(file.type)) {
    showProductImageUploadStatus(
      "Choose a JPEG, PNG, or WebP image.",
      true,
    );
    productImageFileInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showProductImageUploadStatus("Image must be 5 MB or smaller.", true);
    productImageFileInput.value = "";
    return;
  }

  const saveButton = productForm.querySelector('button[type="submit"]');
  const wasSaveButtonDisabled = saveButton.disabled;
  const formData = new FormData();
  formData.append("image", file);
  productImageUploadInProgress = true;
  saveButton.disabled = true;
  productImageFileInput.disabled = true;
  productImageUploadProgress.hidden = false;
  showProductImageUploadStatus("Uploading image to Cloudinary…");

  try {
    const result = await request("/api/admin/uploads/images", {
      method: "POST",
      body: formData,
    });
    const imageUrl = new URL(result?.imageUrl);
    if (imageUrl.protocol !== "https:") {
      throw new Error("The upload API did not return a secure image URL.");
    }

    document.querySelector("#product-image-url").value = imageUrl.toString();
    showProductImageUploadStatus(
      "Image uploaded. Save the product to apply it.",
    );
    showFeedback("Product image uploaded. Save the product to apply it.");
  } catch (error) {
    const message = error.message === "Something went wrong"
      ? "Image upload failed. Please try again."
      : error.message;
    showProductImageUploadStatus(message, true);
    showFeedback(message, true);
  } finally {
    productImageUploadInProgress = false;
    productImageFileInput.disabled = false;
    productImageUploadProgress.hidden = true;
    saveButton.disabled = wasSaveButtonDisabled;
  }
});

function updateProductSelects() {
  const collectionOptions = collections.map((collection) => ({
    id: collection.id,
    label: `${collection.name}${collection.is_active ? "" : " (inactive)"}`,
  }));
  productCollectionSelect.replaceChildren();
  collectionOptions.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    productCollectionSelect.append(option);
  });

  const productOptions = products.map((product) => {
    const collection = collections.find(
      (item) => item.id === product.collection_id,
    );
    return {
      id: product.id,
      label: `${product.name}${collection ? ` — ${collection.name}` : ""}${product.is_active ? "" : " (inactive)"}`,
    };
  });
  variantProductSelect.replaceChildren();
  productOptions.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    variantProductSelect.append(option);
  });

  productForm.querySelector('button[type="submit"]').disabled =
    collections.length === 0;
  variantForm.querySelector('button[type="submit"]').disabled =
    products.length === 0;
}

function renderCollections() {
  catalogueList.replaceChildren();
  if (collections.length === 0) {
    catalogueList.append(
      makeElement("p", "empty-state", "No collections have been created."),
    );
    return;
  }

  collections.forEach((collection) => {
    const card = makeElement("article", "catalogue-item");
    const image = document.createElement("img");
    image.alt = collection.name;
    image.loading = "lazy";
    if (collection.cover_image_url) {
      image.src = collection.cover_image_url;
      image.addEventListener("error", () => {
        image.classList.add("image-unavailable");
        image.alt = "Collection image could not be loaded";
      });
    } else {
      image.hidden = true;
    }

    const copy = makeElement("div", "catalogue-item-copy");
    copy.append(
      makeElement(
        "p",
        "eyebrow",
        collection.is_active ? "ACTIVE COLLECTION" : "INACTIVE COLLECTION",
      ),
      makeElement("h4", "", collection.name),
      makeElement("p", "catalogue-description", `/${collection.slug}`),
      makeElement(
        "p",
        "catalogue-description",
        collection.description || "No description",
      ),
    );
    const actions = makeElement("div", "catalogue-item-actions");
    const edit = makeElement("button", "small-button", "Edit");
    edit.type = "button";
    edit.dataset.editCollection = collection.id;
    const toggle = makeElement(
      "button",
      "small-button",
      collection.is_active ? "Deactivate" : "Activate",
    );
    toggle.type = "button";
    toggle.dataset.toggleCollection = collection.id;
    actions.append(edit, toggle);
    card.append(image, copy, actions);
    catalogueList.append(card);
  });
}

function renderProducts() {
  productList.replaceChildren();
  if (products.length === 0) {
    productList.append(
      makeElement("p", "empty-state", "No products have been created."),
    );
    return;
  }

  products.forEach((product) => {
    const card = makeElement("article", "catalogue-item product-admin-card");
    const image = document.createElement("img");
    image.alt = product.name;
    image.loading = "lazy";
    image.src = productPlaceholder;
    const primaryImage = product.images.find((item) => item.image_url);
    if (primaryImage) {
      image.src = primaryImage.image_url;
      image.alt = primaryImage.alt_text || product.name;
      image.addEventListener("error", () => {
        image.src = productPlaceholder;
        image.alt = `${product.name} image placeholder`;
      }, { once: true });
    }

    const copy = makeElement("div", "catalogue-item-copy");
    const collection = collections.find(
      (item) => item.id === product.collection_id,
    );
    copy.append(
      makeElement(
        "p",
        "eyebrow",
        product.is_active ? "ACTIVE PRODUCT" : "INACTIVE PRODUCT",
      ),
      makeElement("h4", "", product.name),
      makeElement(
        "p",
        "catalogue-description",
        `${collection?.name || "Collection unavailable"} · /${product.slug}`,
      ),
      makeElement(
        "p",
        "catalogue-description",
        product.description || "No description",
      ),
      makeElement(
        "p",
        "catalogue-description",
        `Product price: ${formatPrice(product.price)} · Stock: ${product.stock ?? "not set"}`,
      ),
    );
    const actions = makeElement("div", "catalogue-item-actions");
    const edit = makeElement("button", "small-button", "Edit");
    edit.type = "button";
    edit.dataset.editProduct = product.id;
    const toggle = makeElement(
      "button",
      "small-button",
      product.is_active ? "Deactivate" : "Activate",
    );
    toggle.type = "button";
    toggle.dataset.toggleProduct = product.id;
    actions.append(edit, toggle);
    card.append(image, copy, actions);

    const variants = makeElement("div", "admin-variant-list");
    if (product.variants.length === 0) {
      variants.append(
        makeElement("p", "catalogue-description", "No variants added."),
      );
    }
    product.variants.forEach((variant) => {
      const optionLabel = [variant.size, variant.color]
        .filter(Boolean)
        .join(" · ") || "Standard option";
      const row = makeElement("div", "admin-variant-row");
      row.append(
        makeElement(
          "span",
          "",
          `${variant.sku || "SKU pending"} · ${optionLabel} · ${formatPrice(variant.price)} · Stock ${variant.stock ?? "not set"} · ${variant.is_active ? "Active" : "Inactive"}`,
        ),
      );
      const variantActions = makeElement("span", "admin-variant-actions");
      const editVariant = makeElement("button", "small-button", "Edit");
      editVariant.type = "button";
      editVariant.dataset.editVariant = variant.id;
      editVariant.dataset.productId = product.id;
      const toggleVariant = makeElement(
        "button",
        "small-button",
        variant.is_active ? "Deactivate" : "Activate",
      );
      toggleVariant.type = "button";
      toggleVariant.dataset.toggleVariant = variant.id;
      toggleVariant.dataset.productId = product.id;
      variantActions.append(editVariant, toggleVariant);
      row.append(variantActions);
      variants.append(row);
    });
    const addVariant = makeElement("button", "small-button", "Add variant");
    addVariant.type = "button";
    addVariant.dataset.addVariantFor = product.id;
    variants.append(addVariant);
    card.append(variants);
    productList.append(card);
  });
}

function makeStatusSelect(value, enquiryId) {
  const select = makeElement("select", "status-select");
  select.dataset.enquiryStatus = enquiryId;
  if (!enquiryStatuses.includes(value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `Unrecognized status (${value || "empty"})`;
    option.selected = true;
    option.disabled = true;
    select.append(option);
  }
  enquiryStatuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status[0].toUpperCase() + status.slice(1);
    option.selected = status === value;
    select.append(option);
  });
  return select;
}

function renderEnquiries() {
  enquiriesList.replaceChildren();
  document.querySelector("#enquiry-count").textContent =
    String(enquiries.length);
  if (enquiries.length === 0) {
    enquiriesList.append(
      makeElement("p", "empty-state", "No customer enquiries have been submitted."),
    );
    return;
  }

  enquiries.forEach((enquiry) => {
    const card = makeElement("article", "record-card");
    const heading = makeElement("div", "record-heading");
    heading.append(
      makeElement("h3", "", enquiry.customer_name),
      makeElement("p", "record-date", formatDate(enquiry.created_at)),
    );
    const contact = makeElement(
      "p",
      "record-customer",
      [enquiry.customer_phone, enquiry.customer_email]
        .filter(Boolean)
        .join(" · "),
    );
    const message = makeElement("p", "enquiry-message", enquiry.message);
    const bottom = makeElement("div", "record-bottom");
    const status = makeStatusSelect(enquiry.status, enquiry.id);
    const whatsapp = makeElement("a", "small-button contact-button", "Open WhatsApp");
    whatsapp.href =
      `https://wa.me/${String(enquiry.customer_phone).replace(/\D/g, "")}?text=` +
      encodeURIComponent(`Hello ${enquiry.customer_name}, regarding your enquiry.`);
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    bottom.append(status, whatsapp);
    card.append(heading, contact, message, bottom);
    enquiriesList.append(card);
  });
}

function makeOrderDetailsCell(items) {
  const details = makeElement("details", "order-details");
  const summary = makeElement(
    "summary",
    "",
    `View ${items.length} item${items.length === 1 ? "" : "s"}`,
  );
  const list = makeElement("ul", "order-details-list");
  items.forEach((item) => {
    const variant = [item.selected_size, item.selected_color]
      .filter(Boolean)
      .join(", ");
    const optionText = variant ? ` (${variant})` : "";
    list.append(
      makeElement(
        "li",
        "",
        `${item.product_name || "Unnamed product"}${optionText} × ${item.quantity} · ${formatPrice(item.product_price)} each · line ${formatPrice(item.line_total)}`,
      ),
    );
  });
  if (items.length === 0) {
    list.append(makeElement("li", "", "No item details available"));
  }
  details.append(summary, list);
  return details;
}

function appendOrderRow(order) {
  const view = orderTable.summarizeOrder(order, "database");
  const values = {
    orderId: view.orderId,
    customerName: view.customerName,
    customerPhone: view.customerPhone,
    productSummary: view.productSummary,
    totalItems:
      view.totalItems === null ? "Invalid quantity" : String(view.totalItems),
    totalAmount:
      view.totalAmount === null ? "Unavailable" : formatPrice(view.totalAmount),
    stockDeducted:
      view.stockDeducted === null
        ? "Unavailable"
        : view.stockDeducted
          ? "Yes"
          : "No",
    orderDetails: makeOrderDetailsCell(order.items || []),
    action: makeOrderAction(view),
  };
  const row = document.createElement("tr");
  orderTable.columns.forEach(({ key }) => {
    const cell = document.createElement("td");
    cell.className = `orders-cell-${key}`;
    if (key === "orderDetails" || key === "action") {
      cell.append(values[key]);
    } else {
      cell.textContent = values[key];
    }
    row.append(cell);
  });
  ordersTableBody.append(row);
}

function makeOrderAction(view) {
  const awaitingStockState = confirmationChecks.has(view.databaseOrderId);
  const button = makeElement(
    "button",
    "small-button",
    awaitingStockState
      ? "Check status"
      : view.stockDeducted === true
      ? "Confirmed"
      : view.stockDeducted === false
        ? "Confirm"
        : "Unavailable",
  );
  button.type = "button";
  button.disabled =
    awaitingStockState || view.stockDeducted !== false || !view.databaseOrderId;
  if (view.stockDeducted === false && view.databaseOrderId) {
    button.dataset.confirmOrder = view.databaseOrderId;
  }
  return button;
}

function renderOrders() {
  ordersTableBody.replaceChildren();
  ordersTableHeader.replaceChildren();
  orderTable.columns.forEach(({ label }) => {
    const heading = makeElement("th", "", label);
    heading.scope = "col";
    ordersTableHeader.append(heading);
  });
  document.querySelector("#order-count").textContent =
    String(supabaseOrders.length);

  if (supabaseOrders.length === 0) {
    ordersTable.hidden = true;
    ordersEmpty.textContent = "No Supabase orders have been placed.";
    ordersEmpty.hidden = false;
    return;
  }
  ordersTable.hidden = false;
  ordersEmpty.hidden = true;
  supabaseOrders.forEach(appendOrderRow);
}

async function refreshCatalogue() {
  const result = await request("/api/admin/catalogue");
  collections = Array.isArray(result?.collections) ? result.collections : [];
  products = Array.isArray(result?.products) ? result.products : [];
  updateProductSelects();
  renderCollections();
  renderProducts();
}

async function refreshSupabaseOrders() {
  const result = await request("/api/admin/orders");
  supabaseOrders = Array.isArray(result) ? result : [];
  renderOrders();
}

async function refreshEnquiries() {
  const result = await request("/api/admin/enquiries");
  enquiries = Array.isArray(result) ? result : [];
  renderEnquiries();
}

async function refresh() {
  const results = await Promise.allSettled([
    refreshCatalogue(),
    refreshSupabaseOrders(),
    refreshEnquiries(),
  ]);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason.message);
  if (failures.length > 0) {
    showFeedback(failures.join(" · "), true);
  } else {
    showFeedback("Live Supabase data loaded.");
  }
}

function resetCollectionForm() {
  collectionForm.reset();
  document.querySelector("#collection-id").value = "";
  document.querySelector("#collection-active").checked = true;
  document.querySelector("#collection-form-title").textContent =
    "Add a collection";
  document.querySelector("#cancel-collection-edit").hidden = true;
}

function resetProductForm() {
  productForm.reset();
  productImageUploadProgress.hidden = true;
  showProductImageUploadStatus("");
  document.querySelector("#product-id").value = "";
  document.querySelector("#product-image-id").value = "";
  document.querySelector("#product-active").checked = true;
  document.querySelector("#product-featured").checked = false;
  document.querySelector("#product-sort-order").value = "0";
  document.querySelector("#product-price").value = "";
  document.querySelector("#product-stock").value = "";
  document.querySelector("#initial-variant-fields").hidden = false;
  document.querySelector("#product-form-title").textContent = "Add a product";
  document.querySelector("#cancel-product-edit").hidden = true;
}

function resetVariantForm() {
  variantForm.reset();
  document.querySelector("#variant-id").value = "";
  document.querySelector("#variant-active").checked = true;
  document.querySelector("#variant-form-title").textContent =
    "Add a product variant";
  document.querySelector("#cancel-variant-edit").hidden = true;
}

function editCollection(collection) {
  document.querySelector("#collection-id").value = collection.id;
  document.querySelector("#collection-name").value = collection.name;
  document.querySelector("#collection-slug").value = collection.slug;
  document.querySelector("#collection-description").value =
    collection.description || "";
  document.querySelector("#collection-image").value =
    collection.cover_image_url || "";
  document.querySelector("#collection-active").checked = collection.is_active;
  document.querySelector("#collection-form-title").textContent =
    "Edit collection";
  document.querySelector("#cancel-collection-edit").hidden = false;
  collectionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editProduct(product) {
  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-collection").value = product.collection_id;
  document.querySelector("#product-name").value = product.name;
  document.querySelector("#product-slug").value = product.slug;
  document.querySelector("#product-description").value =
    product.description || "";
  document.querySelector("#product-price").value = product.price ?? "";
  document.querySelector("#product-stock").value = product.stock ?? "";
  const image = product.images[0];
  document.querySelector("#product-image-id").value = image?.id || "";
  document.querySelector("#product-image-url").value = image?.image_url || "";
  document.querySelector("#product-image-alt").value = image?.alt_text || "";
  document.querySelector("#product-active").checked = product.is_active;
  document.querySelector("#product-featured").checked = product.is_featured;
  document.querySelector("#product-sort-order").value =
    String(product.sort_order);
  document.querySelector("#initial-variant-fields").hidden = true;
  document.querySelector("#product-form-title").textContent = "Edit product";
  document.querySelector("#cancel-product-edit").hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editVariant(productId, variant) {
  document.querySelector("#variant-product").value = productId;
  document.querySelector("#variant-id").value = variant.id;
  document.querySelector("#variant-sku").value = variant.sku;
  document.querySelector("#variant-size").value = variant.size || "";
  document.querySelector("#variant-color").value = variant.color || "";
  document.querySelector("#variant-price").value = variant.price ?? "";
  document.querySelector("#variant-stock").value = variant.stock ?? "";
  document.querySelector("#variant-active").checked = variant.is_active;
  document.querySelector("#variant-form-title").textContent =
    "Edit product variant";
  document.querySelector("#cancel-variant-edit").hidden = false;
  variantForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

collectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.querySelector("#collection-id").value;
  const body = {
    name: document.querySelector("#collection-name").value.trim(),
    slug: document.querySelector("#collection-slug").value.trim(),
    description: document.querySelector("#collection-description").value.trim(),
    coverImageUrl: document.querySelector("#collection-image").value.trim(),
    isActive: document.querySelector("#collection-active").checked,
  };
  try {
    await request(
      id
        ? `/api/admin/collections/${encodeURIComponent(id)}`
        : "/api/admin/collections",
      jsonOptions(id ? "PUT" : "POST", body),
    );
    resetCollectionForm();
    await refreshCatalogue();
    showFeedback("Collection saved to Supabase.");
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#cancel-collection-edit").addEventListener(
  "click",
  resetCollectionForm,
);

catalogueList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-collection]");
  const toggleButton = event.target.closest("[data-toggle-collection]");
  if (editButton) {
    const collection = collections.find(
      (item) => item.id === editButton.dataset.editCollection,
    );
    if (collection) editCollection(collection);
    return;
  }
  if (!toggleButton) return;
  const collection = collections.find(
    (item) => item.id === toggleButton.dataset.toggleCollection,
  );
  if (!collection) return;
  const deactivate = collection.is_active;
  if (
    deactivate &&
    !window.confirm(`Deactivate "${collection.name}"? Existing data will be retained.`)
  ) {
    return;
  }
  try {
    await request(
      `/api/admin/collections/${encodeURIComponent(collection.id)}`,
      deactivate
        ? { method: "DELETE" }
        : jsonOptions("PUT", { isActive: true }),
    );
    await refreshCatalogue();
    showFeedback(`Collection ${deactivate ? "deactivated" : "activated"}.`);
  } catch (error) {
    showFeedback(error.message, true);
  }
});

async function saveProductImage(productId) {
  const imageUrl = document.querySelector("#product-image-url").value.trim();
  if (!imageUrl) return;
  const imageId = document.querySelector("#product-image-id").value;
  const body = {
    imageUrl,
    altText: document.querySelector("#product-image-alt").value.trim(),
    sortOrder: 0,
  };
  const path = imageId
    ? `/api/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`
    : `/api/admin/products/${encodeURIComponent(productId)}/images`;
  const result = await request(
    path,
    jsonOptions(imageId ? "PUT" : "POST", body),
  );
  if (!imageId && result?.id) {
    document.querySelector("#product-image-id").value = result.id;
  }
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (productImageUploadInProgress) {
    showFeedback("Wait for the image upload to finish before saving.", true);
    return;
  }
  const id = document.querySelector("#product-id").value;
  const slug = document.querySelector("#product-slug").value.trim();
  const body = {
    collectionId: document.querySelector("#product-collection").value,
    name: document.querySelector("#product-name").value.trim(),
    ...(slug ? { slug } : {}),
    description: document.querySelector("#product-description").value.trim(),
    ...(document.querySelector("#product-price").value.trim()
      ? { price: Number(document.querySelector("#product-price").value) }
      : id ? { price: null } : {}),
    ...(document.querySelector("#product-stock").value.trim()
      ? { stock: Number(document.querySelector("#product-stock").value) }
      : id ? { stock: null } : {}),
    isActive: document.querySelector("#product-active").checked,
    isFeatured: document.querySelector("#product-featured").checked,
    sortOrder: Number(document.querySelector("#product-sort-order").value),
  };
  const initialVariant = {
    sku: document.querySelector("#initial-variant-sku").value.trim(),
    size: document.querySelector("#initial-variant-size").value.trim(),
    color: document.querySelector("#initial-variant-color").value.trim(),
    price: document.querySelector("#initial-variant-price").value.trim(),
    stock: document.querySelector("#initial-variant-stock").value.trim(),
  };
  const shouldCreateInitialVariant =
    !id && Object.values(initialVariant).some(Boolean);
  try {
    const product = await request(
      id
        ? `/api/admin/products/${encodeURIComponent(id)}`
        : "/api/admin/products",
      jsonOptions(id ? "PUT" : "POST", body),
    );
    const productId = id || product?.id;
    if (!productId) {
      throw new Error(
        "The product was saved without returning its database ID. Check the catalogue before retrying.",
      );
    }
    let imageError = null;
    try {
      await saveProductImage(productId);
    } catch (error) {
      imageError = error;
    }
    let variantError = null;
    if (shouldCreateInitialVariant) {
      const variantBody = {
        size: initialVariant.size,
        color: initialVariant.color,
        ...(initialVariant.sku ? { sku: initialVariant.sku } : {}),
        ...(initialVariant.price
          ? { price: Number(initialVariant.price) }
          : body.price !== undefined
            ? { price: body.price }
            : {}),
        ...(initialVariant.stock
          ? { stock: Number(initialVariant.stock) }
          : body.stock !== undefined
            ? { stock: body.stock }
            : {}),
      };
      try {
        await request(
          `/api/admin/products/${encodeURIComponent(productId)}/variants`,
          jsonOptions("POST", variantBody),
        );
      } catch (error) {
        variantError = error;
      }
    }
    resetProductForm();
    await refreshCatalogue();
    if (imageError || variantError) {
      const partialFailures = [
        imageError && `image: ${imageError.message}`,
        variantError && `initial variant: ${variantError.message}`,
      ].filter(Boolean);
      showFeedback(
        `Product saved, but ${partialFailures.join("; ")} could not be saved.`,
        true,
      );
    } else {
      showFeedback("Product saved to Supabase.");
    }
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#cancel-product-edit").addEventListener(
  "click",
  resetProductForm,
);

productList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-product]");
  const toggleButton = event.target.closest("[data-toggle-product]");
  const editVariantButton = event.target.closest("[data-edit-variant]");
  const toggleVariantButton = event.target.closest("[data-toggle-variant]");
  const addVariantButton = event.target.closest("[data-add-variant-for]");

  if (editButton) {
    const product = products.find((item) => item.id === editButton.dataset.editProduct);
    if (product) editProduct(product);
    return;
  }
  if (addVariantButton) {
    resetVariantForm();
    variantProductSelect.value = addVariantButton.dataset.addVariantFor;
    variantForm.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (editVariantButton) {
    const product = products.find(
      (item) => item.id === editVariantButton.dataset.productId,
    );
    const variant = product?.variants.find(
      (item) => item.id === editVariantButton.dataset.editVariant,
    );
    if (product && variant) editVariant(product.id, variant);
    return;
  }
  if (toggleVariantButton) {
    const productId = toggleVariantButton.dataset.productId;
    const product = products.find((item) => item.id === productId);
    const variant = product?.variants.find(
      (item) => item.id === toggleVariantButton.dataset.toggleVariant,
    );
    if (!variant) return;
    const deactivate = variant.is_active;
    if (
      deactivate &&
      !window.confirm(`Deactivate variant ${variant.sku}? Existing data will be retained.`)
    ) {
      return;
    }
    try {
      await request(
        `/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variant.id)}`,
        deactivate
          ? { method: "DELETE" }
          : jsonOptions("PUT", { isActive: true }),
      );
      await refreshCatalogue();
      showFeedback(`Variant ${deactivate ? "deactivated" : "activated"}.`);
    } catch (error) {
      showFeedback(error.message, true);
    }
    return;
  }
  if (!toggleButton) return;
  const product = products.find(
    (item) => item.id === toggleButton.dataset.toggleProduct,
  );
  if (!product) return;
  const deactivate = product.is_active;
  if (
    deactivate &&
    !window.confirm(`Deactivate "${product.name}"? Existing data will be retained.`)
  ) {
    return;
  }
  try {
    await request(
      `/api/admin/products/${encodeURIComponent(product.id)}`,
      deactivate
        ? { method: "DELETE" }
        : jsonOptions("PUT", { isActive: true }),
    );
    await refreshCatalogue();
    showFeedback(`Product ${deactivate ? "deactivated" : "activated"}.`);
  } catch (error) {
    showFeedback(error.message, true);
  }
});

variantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const productId = variantProductSelect.value;
  const id = document.querySelector("#variant-id").value;
  const body = {
    sku: document.querySelector("#variant-sku").value.trim(),
    size: document.querySelector("#variant-size").value.trim(),
    color: document.querySelector("#variant-color").value.trim(),
    ...(document.querySelector("#variant-price").value.trim()
      ? { price: Number(document.querySelector("#variant-price").value) }
      : id ? { price: null } : {}),
    ...(document.querySelector("#variant-stock").value.trim()
      ? { stock: Number(document.querySelector("#variant-stock").value) }
      : id ? { stock: null } : {}),
    isActive: document.querySelector("#variant-active").checked,
  };
  try {
    await request(
      id
        ? `/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(id)}`
        : `/api/admin/products/${encodeURIComponent(productId)}/variants`,
      jsonOptions(id ? "PUT" : "POST", body),
    );
    resetVariantForm();
    await refreshCatalogue();
    showFeedback("Product variant saved to Supabase.");
  } catch (error) {
    showFeedback(error.message, true);
  }
});

document.querySelector("#cancel-variant-edit").addEventListener(
  "click",
  resetVariantForm,
);

async function confirmDatabaseOrder(button) {
  const order = supabaseOrders.find(
    (item) => item.id === button.dataset.confirmOrder,
  );
  if (!order || order.stock_deducted || button.disabled) return;
  button.disabled = true;
  button.textContent = "Confirming…";
  try {
    await request(
      `/api/orders/${encodeURIComponent(order.id)}/confirm`,
      { method: "POST" },
    );
    confirmationChecks.add(order.id);
    await refreshSupabaseOrders();
    const refreshedOrder = supabaseOrders.find((item) => item.id === order.id);
    if (refreshedOrder?.stock_deducted === true) {
      showFeedback(`Supabase order ${order.id} confirmed.`);
    } else {
      showFeedback(
        `Confirmation was accepted, but the order does not report deducted stock. Do not retry until its database state is checked.`,
        true,
      );
    }
  } catch (error) {
    if (confirmationChecks.has(order.id)) {
      button.disabled = true;
      button.textContent = "Check status";
      showFeedback(
        `Confirmation was accepted but its stock state could not be refreshed. Do not retry until it is checked.`,
        true,
      );
    } else {
      button.disabled = false;
      button.textContent = "Confirm";
      showFeedback(error.message, true);
    }
  }
}

ordersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-confirm-order]");
  if (button) void confirmDatabaseOrder(button);
});

enquiriesList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-enquiry-status]");
  if (!select) return;
  const enquiry = enquiries.find(
    (item) => item.id === select.dataset.enquiryStatus,
  );
  if (!enquiry || !enquiryStatuses.includes(select.value)) return;
  select.disabled = true;
  try {
    const updated = await request(
      `/api/admin/enquiries/${encodeURIComponent(enquiry.id)}`,
      jsonOptions("PATCH", { status: select.value }),
    );
    Object.assign(enquiry, updated);
    showFeedback("Enquiry status updated in Supabase.");
  } catch (error) {
    select.value = enquiry.status;
    showFeedback(error.message, true);
  } finally {
    select.disabled = false;
  }
});

window.CoutureAdminDashboard = { refresh };

void refresh();
