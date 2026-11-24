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

function createBuildFixture(temporaryRoot) {
  const fixtureRoot = path.join(temporaryRoot, "project");
  fs.mkdirSync(fixtureRoot);
  for (const file of FRONTEND_FILES) {
    fs.copyFileSync(path.join(projectRoot, file), path.join(fixtureRoot, file));
  }
  const rootConfig = fs.readFileSync(
    path.join(projectRoot, "netlify.toml"),
  );
  fs.writeFileSync(path.join(fixtureRoot, "netlify.toml"), rootConfig);
  return { fixtureRoot, rootConfig };
}

test("Netlify build replaces stale dist contents without modifying root config", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(projectRoot, ".netlify-build-test-"),
  );
  const { fixtureRoot, rootConfig } = createBuildFixture(temporaryRoot);
  const outputDir = path.join(fixtureRoot, "dist");
  fs.mkdirSync(outputDir);
  fs.copyFileSync(
    path.join(fixtureRoot, "netlify.toml"),
    path.join(outputDir, "netlify.toml"),
  );
  fs.writeFileSync(path.join(outputDir, "stale-output.txt"), "stale");

  try {
    buildNetlifySite({
      projectRoot: fixtureRoot,
      outputDir,
      apiBaseUrl: "https://api.example.test",
    });

    assert.deepEqual(fs.readdirSync(outputDir).sort(), [...FRONTEND_FILES].sort());
    assert.deepEqual(
      fs.readFileSync(path.join(fixtureRoot, "netlify.toml")),
      rootConfig,
    );
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
    assert.equal(fs.existsSync(path.join(outputDir, "netlify.toml")), false);
    assert.equal(fs.existsSync(path.join(outputDir, "stale-output.txt")), false);
    assert.equal(
      fs.existsSync(path.join(outputDir, "reset-password.html")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(outputDir, "collection-navigation.js")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(outputDir, "password-recovery.js")),
      true,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Netlify build refuses to clean anything other than the project's dist", () => {
  const rootConfig = fs.readFileSync(path.join(projectRoot, "netlify.toml"));

  assert.throws(
    () =>
      buildNetlifySite({
        projectRoot,
        outputDir: projectRoot,
        apiBaseUrl: "https://api.example.test",
      }),
    /must be the project's dist directory/,
  );
  assert.deepEqual(fs.readFileSync(path.join(projectRoot, "netlify.toml")), rootConfig);
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
