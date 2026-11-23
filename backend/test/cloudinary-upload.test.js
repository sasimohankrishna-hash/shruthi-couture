const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function createUploadTestContext({
  isAdmin = true,
  uploadImage = async () => ({
    secure_url: "https://res.cloudinary.com/example/image/upload/product.png",
    public_id: "shrithi-couture/products/product",
  }),
} = {}) {
  const calls = { uploads: 0 };
  const app = createApp({
    supabase: {
      auth: {
        async getUser(token) {
          return {
            data: token === "valid-token"
              ? { user: { id: "admin-id", email: "admin@example.com" } }
              : { user: null },
            error: null,
          };
        },
      },
    },
    frontendUrl: "http://localhost:5500",
    authenticatedSupabaseClientFactory: () => ({
      async rpc() {
        return { data: isAdmin, error: null };
      },
    }),
    uploadImage: async (buffer) => {
      calls.uploads += 1;
      return uploadImage(buffer);
    },
  });

  return { app, calls };
}

async function postImage(app, {
  token = "valid-token",
  bytes = pngHeader,
  mimeType = "image/png",
} = {}) {
  const server = app.listen(0);
  try {
    const address = server.address();
    const form = new FormData();
    form.append("image", new Blob([bytes], { type: mimeType }), "product.png");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return await fetch(`http://127.0.0.1:${address.port}/api/admin/uploads/images`, {
      method: "POST",
      headers,
      body: form,
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
}

test("admin image upload returns Cloudinary's secure URL", async () => {
  let uploadedBuffer;
  const { app, calls } = createUploadTestContext({
    uploadImage: async (buffer) => {
      uploadedBuffer = buffer;
      return {
        secure_url: "https://res.cloudinary.com/example/image/upload/product.png",
        public_id: "shrithi-couture/products/product",
      };
    },
  });

  const response = await postImage(app);
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.success, true);
  assert.equal(
    payload.data.imageUrl,
    "https://res.cloudinary.com/example/image/upload/product.png",
  );
  assert.deepEqual(uploadedBuffer, pngHeader);
  assert.equal(calls.uploads, 1);
});

test("image upload requires an authenticated administrator", async () => {
  const { app, calls } = createUploadTestContext();

  const unauthenticated = await postImage(app, { token: null });
  assert.equal(unauthenticated.status, 401);

  const nonAdminContext = createUploadTestContext({ isAdmin: false });
  const nonAdminResponse = await postImage(nonAdminContext.app);
  assert.equal(nonAdminResponse.status, 403);
  assert.equal(calls.uploads, 0);
  assert.equal(nonAdminContext.calls.uploads, 0);
});

test("image upload rejects unsupported and mismatched file content", async () => {
  const { app, calls } = createUploadTestContext();

  const unsupported = await postImage(app, {
    bytes: Buffer.from("not an image"),
    mimeType: "image/png",
  });
  assert.equal(unsupported.status, 400);

  const mismatched = await postImage(app, {
    bytes: pngHeader,
    mimeType: "image/jpeg",
  });
  assert.equal(mismatched.status, 400);
  assert.equal(calls.uploads, 0);
});

test("image upload rejects files larger than 5 MB", async () => {
  const { app, calls } = createUploadTestContext();
  const oversized = Buffer.concat([
    pngHeader,
    Buffer.alloc(5 * 1024 * 1024),
  ]);

  const response = await postImage(app, { bytes: oversized });

  assert.equal(response.status, 413);
  assert.equal(calls.uploads, 0);
});

test("Cloudinary failures return a sanitized upload error", async () => {
  const { app } = createUploadTestContext({
    uploadImage: async () => {
      throw new Error("provider details must not reach the client");
    },
  });

  const response = await postImage(app);
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.deepEqual(payload, {
    success: false,
    message: "Something went wrong",
  });
});
