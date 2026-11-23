(() => {
  function getApiBaseUrl() {
    const apiBaseUrl = window.COUTURE_SUPABASE_CONFIG?.apiBaseUrl;
    let url;
    try {
      url = new URL(apiBaseUrl);
    } catch {
      throw new Error("The storefront API URL is not configured correctly.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("The storefront API URL must use HTTP or HTTPS.");
    }
    return url.origin;
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(new URL(path, `${getApiBaseUrl()}/`), {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error("Could not reach the store. Please try again.");
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The store returned an invalid response.");
    }
    if (!response.ok || payload?.success !== true) {
      throw new Error(
        typeof payload?.message === "string"
          ? payload.message
          : "The request could not be completed.",
      );
    }
    return payload.data;
  }

  window.CoutureApi = Object.freeze({
    getCollections() {
      return request("/api/collections");
    },
    getCollection(identifier) {
      return request(`/api/collections/${encodeURIComponent(identifier)}`);
    },
    getProductsByCollection(identifier) {
      return request(
        `/api/collections/${encodeURIComponent(identifier)}/products`,
      );
    },
    searchProducts(searchTerm) {
      return request(`/api/products?search=${encodeURIComponent(searchTerm)}`);
    },
    createOrder(order) {
      return request("/api/orders", {
        method: "POST",
        body: JSON.stringify(order),
      });
    },
    createEnquiry(enquiry) {
      return request("/api/enquiries", {
        method: "POST",
        body: JSON.stringify(enquiry),
      });
    },
  });
})();
