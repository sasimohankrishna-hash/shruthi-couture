const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_FILES = [
  "_headers",
  "admin-auth-entry.mjs",
  "admin-auth.js",
  "admin-order-table.js",
  "admin.css",
  "admin.html",
  "collection.html",
  "collection.js",
  "index.html",
  "password-recovery.js",
  "reset-password-entry.mjs",
  "reset-password.html",
  "script.js",
  "store-data.js",
  "storefront-api.js",
  "styles.css",
  "supabase-config.js",
];

function validateApiOrigin(value) {
  if (!value) {
    throw new Error("COUTURE_API_BASE_URL must be set to the deployed backend origin.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("COUTURE_API_BASE_URL must be a valid HTTPS origin.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("COUTURE_API_BASE_URL must be an HTTPS origin without a path.");
  }

  return url.origin;
}

function prepareOutputDirectory(outputDir, projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedOutput = path.resolve(outputDir);
  if (resolvedOutput !== path.join(resolvedRoot, "dist")) {
    throw new Error("The frontend build output must be the project's dist directory.");
  }

  let outputStats;
  try {
    outputStats = fs.lstatSync(resolvedOutput);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (outputStats) {
    if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
      throw new Error("Refusing to clean a non-directory Netlify build output.");
    }
    fs.rmSync(resolvedOutput, { recursive: true, force: true });
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
}

function buildNetlifySite({
  projectRoot = path.resolve(__dirname, ".."),
  outputDir = path.join(projectRoot, "dist"),
  apiBaseUrl = process.env.COUTURE_API_BASE_URL,
} = {}) {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedOutput = path.resolve(outputDir);
  const resolvedApiOrigin = validateApiOrigin(apiBaseUrl);

  for (const file of FRONTEND_FILES) {
    if (!fs.statSync(path.join(resolvedRoot, file)).isFile()) {
      throw new Error(`Required frontend file is missing: ${file}`);
    }
  }

  prepareOutputDirectory(resolvedOutput, resolvedRoot);

  for (const file of FRONTEND_FILES) {
    const sourcePath = path.join(resolvedRoot, file);
    const targetPath = path.join(resolvedOutput, file);
    if (file !== "supabase-config.js") {
      fs.copyFileSync(sourcePath, targetPath);
      continue;
    }

    const source = fs.readFileSync(sourcePath, "utf8");
    const apiUrlPattern = /apiBaseUrl:\s*"[^"]+"/;
    if (!apiUrlPattern.test(source)) {
      throw new Error("Could not locate apiBaseUrl in supabase-config.js.");
    }
    fs.writeFileSync(
      targetPath,
      source.replace(
        apiUrlPattern,
        `apiBaseUrl: ${JSON.stringify(resolvedApiOrigin)}`,
      ),
    );
  }

  return resolvedOutput;
}

if (require.main === module) {
  const outputDir = buildNetlifySite();
  console.log(`Frontend deployment files prepared in ${outputDir}.`);
}

module.exports = { FRONTEND_FILES, buildNetlifySite, validateApiOrigin };
