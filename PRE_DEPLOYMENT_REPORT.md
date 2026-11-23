# Shruthi Couture Pre-Deployment Report

**Audit date:** 2026-11-23  
**Scope:** Source/configuration review, automated tests, Supabase read-only
checks, and Cloudinary credential ping. Deployment/build configuration was
added or tightened. No database rows, Cloudinary assets, or deployments were
changed.

## Verdict: NOT READY

The deployment build now supports a required HTTPS backend URL and publishes
only an allow-listed frontend artifact. It is still not ready to deploy: no
production backend URL or Netlify frontend origin has been supplied, the live
catalogue is empty, the current Git root does not track this project folder,
and critical Supabase authentication, RLS, and order-function behavior remains
unverified.

## Findings

| Area | Result | Evidence / remaining work |
|---|---|---|
| Frontend | **Partially verified** | Storefront and Admin Panel remain static HTML/CSS/Vanilla JavaScript. The local config still points to localhost; the Netlify build helper injects the required `COUTURE_API_BASE_URL` into the generated artifact. No production URL is configured, and no live browser sign-in/full UI flow was performed. Syntax checks passed for 37 JavaScript files. |
| Backend | **Read-only checks passed** | With the local origin, backend returned 200 for collections/products (both empty) and 401 for unauthenticated admin session/catalogue requests. CORS now requires exact HTTPS origins except localhost development. The production `FRONTEND_URL` is not configured. Node.js is 22.20.0; the package requires Node.js 20+. |
| Supabase | **Connected; production behavior unverified** | Frontend and backend project references match, and the frontend publishable key was accepted by the configured Auth endpoint. The supplied UUID has a row in `admin_users` (read-only exact lookup). Public catalogue APIs returned zero collections/products. No user login or `is_admin()` RPC was performed; live function definitions, RLS policies, grants, and order RPC behavior remain unverified. |
| Cloudinary | **Credentials accepted; upload not live-tested** | Required local environment variables are present, and a read-only Cloudinary ping succeeded. An actual image upload was not attempted because it creates a Cloudinary asset. Automated upload tests use a mock. |
| Environment variables | **Local setup present; production setup missing** | Required backend variables are present locally and the port is valid. `FRONTEND_URL` is local-only, and the frontend API URL is localhost. Production hosting environment variables and origins have not been configured or verified. |
| Security | **Improved; review remains** | Netlify build output is limited to explicit frontend files, so backend source and local `.env` are excluded. The local `.env` is ignored by `backend/.gitignore`; a legacy `SUPABASE_SERVICE_ROLE_KEY` variable is present locally but unused by backend code. Do not copy it to hosting. Backend 5xx logs include raw `error.message`; review/sanitize upstream details. Basic Netlify security headers are added; CSP still needs review for the external CDNs. |
| Tests | **Passed** | Backend `npm test`: **56 passed, 0 failed**. Netlify artifact tests: **2 passed, 0 failed**. `node --check` passed for 37 JavaScript files. Tests are primarily mocked and do not establish live user login, Cloudinary file upload, or browser behavior. |
| Netlify / hosting | **Configuration scaffolded; not deploy-ready** | `netlify.toml` builds an allow-listed frontend artifact to `dist` and sets Node.js 20 for the build. The build requires `COUTURE_API_BASE_URL`, which is not yet provided. The Express backend requires a separate Node.js host. The local Git root is the parent `C:\Users\mohan`; Git reports zero tracked paths under `ecom-2`. Do not connect or publish the parent directory. Configure Netlify against the correct repository/project base and verify it reads this project's `netlify.toml` before any deployment. |

## Important unverified items

- The Supabase database is reachable, but zero active catalogue records were
  returned. Real storefront browsing, product selection, image display, and
  checkout therefore remain unverified.
- The live admin login and `is_admin()` RPC were not tested. The supplied
  `admin_users` mapping exists, but that alone does not prove the function or
  RLS behavior. No client or owner password was requested or used.
- The SQL bodies and permissions for `is_admin()`, `create_order()`, and
  `confirm_order()`, along with RLS policies, are not available in the
  repository. Existing audit notes also record a reported but unconfirmed
  product/variant ID issue in `create_order()`. Review these definitions using
  authorized, read-only database access before any live order or stock test.
- Enquiry status constraints and confirmation stock atomicity/idempotency are
  not verified.
- A Cloudinary ping verifies credentials, not upload permissions or the
  complete Admin Panel-to-Supabase product-image flow.
- The UI uses third-party CDN scripts. Configure appropriate HTTPS and
  security headers (including a reviewed CSP) on the frontend host.

## Required before deployment

1. Select the correct Git repository/base directory for this project; do not
   use or publish the parent `C:\Users\mohan` directory.
2. Choose and configure the production backend HTTPS host. Set its
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `PORT`, and exact production `FRONTEND_URL` in the backend host's secret
   environment. Never place server secrets in Netlify frontend settings/code.
3. Set Netlify's `COUTURE_API_BASE_URL` to that HTTPS backend origin. Confirm
   the Netlify base directory/build config and backend CORS origin match the
   actual deployed frontend domain. Do not deploy until the correct project
   repository/base is configured.
4. Review the live database function definitions, grants, and RLS policies.
   Resolve any confirmed order/stock defects before testing order writes.
5. In a separate Supabase test project, use approved test products, variants,
   and images to verify admin login/logout, catalogue CRUD, Cloudinary upload
   and URL persistence, enquiries, storefront checkout, and stock confirmation.
   Do not use production business data for write tests.
6. Have the owner verify the intended admin accounts and confirm the
   production WhatsApp contact/configuration.
7. Review server log redaction, review CSP for the CDN dependencies, and
   configure HTTPS/security headers before
   launch.

## Verification commands and results

- Backend `npm test` — **56 passed, 0 failed**.
- `node --test scripts/build-netlify.test.js` — **2 passed, 0 failed**.
- JavaScript syntax — **37 files passed**.
- Read-only local backend integration using the configured `.env` and an
  ephemeral port — health and public catalogue endpoints responded
  successfully; catalogue counts were zero; unauthenticated admin catalogue
  request returned the expected 401. This did not test a deployed host or the
  configured fixed port.
- Cloudinary API ping — credentials accepted; no asset was uploaded.
- Admin mapping — supplied Auth UUID has an `admin_users` row; unauthenticated
  admin endpoints return 401. The `is_admin()` function was not invoked because
  no user access token was provided.
- Netlify artifact test — HTTPS API origin injection and frontend-only file
  allow-list passed. No production API URL or Netlify site was configured.
- Secret handling — no server-only key variable names found in the checked
  frontend runtime files; local `.env` is ignored. This is not a Git-history
  secret scan.

## Final status

**NOT READY**
