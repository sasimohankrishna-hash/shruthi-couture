const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FRONTEND_FILES,
  buildNetlifySite,
  validateApiOrigin,
} = require("./build-netlify");

const projectRoot = path.resolve(__dirname, "..");

test("Netlify build writes the HTTPS API origin into a frontend-only artifact", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(projectRoot, ".netlify-build-test-"),
  );
  const outputDir = path.join(temporaryRoot, "site");

  try {
    buildNetlifySite({
      projectRoot,
      outputDir,
      apiBaseUrl: "https://api.example.test",
    });

    assert.deepEqual(fs.readdirSync(outputDir).sort(), [...FRONTEND_FILES].sort());
    const config = fs.readFileSync(
      path.join(outputDir, "supabase-config.js"),
      "utf8",
    );
    assert.match(config, /apiBaseUrl:\s*"https:\/\/api\.example\.test"/);
    const headers = fs.readFileSync(path.join(outputDir, "_headers"), "utf8");
    assert.match(headers, /X-Content-Type-Options: nosniff/);
    assert.match(headers, /X-Frame-Options: DENY/);
    assert.equal(fs.existsSync(path.join(outputDir, "backend")), false);
    assert.equal(fs.existsSync(path.join(outputDir, ".env")), false);
    assert.equal(fs.existsSync(path.join(outputDir, "PRE_DEPLOYMENT_REPORT.md")), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Netlify build requires an HTTPS origin without a path", () => {
  assert.throws(
    () => validateApiOrigin("http://api.example.test"),
    /HTTPS origin/,
  );
  assert.throws(
    () => validateApiOrigin("https://api.example.test/api"),
    /without a path/,
  );
  assert.throws(
    () => validateApiOrigin(""),
    /COUTURE_API_BASE_URL must be set/,
  );
});
