const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAuthenticatedSupabaseClient,
  createSupabaseClient,
} = require("../src/config/supabase");

test("Supabase client accepts the new secret key variable and base project URL", () => {
  const client = createSupabaseClient({
    SUPABASE_URL: "https://example-project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test_placeholder",
  });

  assert.equal(client.supabaseUrl, "https://example-project.supabase.co");
});

test("Supabase client does not accept the legacy key variable as a substitute", () => {
  assert.throws(
    () =>
      createSupabaseClient({
        SUPABASE_URL: "https://example-project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "legacy-placeholder",
      }),
    /SUPABASE_SECRET_KEY must be configured/,
  );
});

test("authenticated RPC client uses only the publishable key and user Bearer token", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (input, init) => {
    request = {
      url: String(input),
      headers: new Headers(init.headers),
    };
    return new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = createAuthenticatedSupabaseClient(
      "admin-access-token",
      {
        SUPABASE_URL: "https://example-project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_placeholder",
      },
    );
    await client.rpc("confirm_order", {
      p_order_id: "11111111-1111-4111-8111-111111111111",
    });

    assert.match(request.url, /\/rest\/v1\/rpc\/confirm_order$/);
    assert.equal(
      request.headers.get("apikey"),
      "sb_publishable_test_placeholder",
    );
    assert.equal(
      request.headers.get("authorization"),
      "Bearer admin-access-token",
    );
  } finally {
    global.fetch = originalFetch;
  }
});
