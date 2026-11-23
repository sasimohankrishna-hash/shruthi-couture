const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdminAuth } = require("../../admin-auth");

const ownerSession = {
  access_token: "owner-access-token",
  user: { email: "suryapadma21@gmail.com" },
};

function createSupabaseMock({
  session = ownerSession,
  signInError = null,
  sessionError = null,
  signOutError = null,
} = {}) {
  const calls = { login: [], signOut: 0 };
  return {
    calls,
    client: {
      auth: {
        async signInWithPassword(credentials) {
          calls.login.push(credentials);
          return { data: { session }, error: signInError };
        },
        async getSession() {
          return { data: { session }, error: sessionError };
        },
        async signOut() {
          calls.signOut += 1;
          return { error: signOutError };
        },
      },
    },
  };
}

function successfulResponse(data = { isAdmin: true, email: ownerSession.user.email }) {
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("owner login verifies the session with the backend using the Bearer token", async () => {
  const fake = createSupabaseMock();
  const requests = [];
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return successfulResponse();
    },
  });

  const result = await auth.login("suryapadma21@gmail.com", "entered-password");

  assert.equal(result.status, "authorized");
  assert.equal(result.email, "suryapadma21@gmail.com");
  assert.deepEqual(fake.calls.login, [
    { email: "suryapadma21@gmail.com", password: "entered-password" },
  ]);
  assert.equal(requests[0].url, "http://localhost:5000/api/admin/session");
  assert.equal(
    requests[0].options.headers.get("Authorization"),
    "Bearer owner-access-token",
  );
});

test("invalid passwords produce a clear sign-in error", async () => {
  const fake = createSupabaseMock({
    signInError: { code: "invalid_credentials" },
  });
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () => successfulResponse(),
  });

  await assert.rejects(
    auth.login("owner@example.com", "wrong-password"),
    {
      message: "Incorrect email or password for this project's Supabase Auth account. The Supabase organization password is separate.",
    },
  );
});

test("unverified email produces a clear sign-in error", async () => {
  const fake = createSupabaseMock({
    signInError: { code: "email_not_confirmed" },
  });
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () => successfulResponse(),
  });

  await assert.rejects(
    auth.login("owner@example.com", "password"),
    { message: "Please verify your email before signing in." },
  );
});

test("login rejects a missing Supabase session and clears it", async () => {
  const fake = createSupabaseMock({ session: null });
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () => successfulResponse(),
  });

  const result = await auth.login("owner@example.com", "password");

  assert.equal(result.status, "missing_session");
  assert.equal(fake.calls.signOut, 1);
});

test("non-admin login is rejected and signs the user out", async () => {
  const fake = createSupabaseMock();
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: false,
          message: "Administrator access required",
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
  });

  const result = await auth.login("customer@example.com", "password");

  assert.equal(result.status, "denied");
  assert.equal(fake.calls.signOut, 1);
});

test("session restoration verifies the persisted Supabase session", async () => {
  const fake = createSupabaseMock();
  const requests = [];
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return successfulResponse();
    },
  });

  const result = await auth.restore();

  assert.equal(result.status, "authorized");
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].options.headers.get("Authorization"),
    "Bearer owner-access-token",
  );
});

test("backend verification network failures are surfaced without authorizing", async () => {
  const fake = createSupabaseMock();
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });

  await assert.rejects(
    auth.login("owner@example.com", "password"),
    {
      message: "Unable to reach the backend. Check your network and try again.",
    },
  );
});

test("logout clears the Supabase session", async () => {
  const fake = createSupabaseMock();
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async () => successfulResponse(),
  });

  await auth.logout();

  assert.equal(fake.calls.signOut, 1);
});

test("protected order confirmation forwards the current admin JWT", async () => {
  const fake = createSupabaseMock();
  const requests = [];
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return successfulResponse(null);
    },
  });

  const response = await auth.request(
    "/api/orders/11111111-1111-4111-8111-111111111111/confirm",
    { method: "POST" },
  );

  assert.equal(response.status, 200);
  assert.equal(
    requests[0].url,
    "http://localhost:5000/api/orders/11111111-1111-4111-8111-111111111111/confirm",
  );
  assert.equal(requests[0].options.method, "POST");
  assert.equal(
    requests[0].options.headers.get("Authorization"),
    "Bearer owner-access-token",
  );
});

test("multipart image requests forward the admin JWT without setting JSON content type", async () => {
  const fake = createSupabaseMock();
  const requests = [];
  const auth = createAdminAuth({
    supabase: fake.client,
    apiBaseUrl: "http://localhost:5000",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return successfulResponse({ imageUrl: "https://example.com/image.png" });
    },
  });
  const formData = new FormData();
  formData.append(
    "image",
    new Blob(["image data"], { type: "image/png" }),
    "product.png",
  );

  const response = await auth.request("/api/admin/uploads/images", {
    method: "POST",
    body: formData,
  });

  assert.equal(response.status, 200);
  assert.equal(
    requests[0].options.headers.get("Authorization"),
    "Bearer owner-access-token",
  );
  assert.equal(requests[0].options.headers.has("Content-Type"), false);
  assert.equal(requests[0].options.body, formData);
});
