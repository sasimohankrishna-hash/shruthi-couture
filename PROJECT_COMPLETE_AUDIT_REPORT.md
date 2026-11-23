# Shruthi's Couture — Complete Project Audit Report

**Audit date:** 2026-11-17  
**Project:** `C:\Users\mohan\ecom-2`  
**Overall status: PARTIALLY IMPLEMENTED / NOT READY TO CALL COMPLETE**

The project has a static HTML/CSS/Vanilla JavaScript storefront, a separate
Express API, Supabase Auth integration, and a protected owner dashboard. The
main code paths for catalogue administration, customer enquiries, and order
creation exist and the backend mock suite passes. Read-only checks confirmed
that the Supabase project is reachable, the expected tables and RPC paths are
exposed, and an `admin_users` row refers to an existing Supabase Auth user.

The audit did **not** create or modify any database rows, invoke an RPC, change
authentication, reset a password, or expose an identity or credential. Live
owner sign-in and the `is_admin()` result were not tested. The live catalogue,
orders, order items, and enquiries are empty. The SQL definitions, constraints,
RLS policies, and RPC security settings remain unavailable for verification.
Accordingly, live order/stock behavior and production readiness remain blocked.

## 1. Scope, evidence, and limits

### Inspected

- All project source files listed by the workspace inventory, excluding
  dependency directories and the ignored local environment file.
- Storefront HTML, JavaScript, and CSS; Admin HTML, JavaScript, CSS, and Auth
  modules.
- Backend routes, controllers, configuration, middleware, package manifests,
  and tests.
- All project Markdown documentation present in the workspace:
  [PHASE_1_COMPLETION_REPORT.md](./PHASE_1_COMPLETION_REPORT.md),
  [PHASE_1_SCHEMA_AUDIT.md](./PHASE_1_SCHEMA_AUDIT.md),
  [DATABASE_SCHEMA_FINAL.md](./DATABASE_SCHEMA_FINAL.md), and
  [backend/README.md](./backend/README.md).
- Both SQL files under `database/migrations/`; they contain comments and
  read-only query text only, not executable schema/function changes.

There is no root README or frontend package manifest/build/test runner. The
backend package requires Node.js 20 or newer and uses the built-in Node test
runner. A nested `backend/backend/` directory also contains a package manifest
and lockfile whose dependency points back to the parent backend package; the
active test command is run from `backend/`, and the nested artifacts were left
untouched.

### Evidence labels used below

- **Verified—source:** directly observed in current source or configuration
  structure.
- **Verified—live read-only:** observed during this audit through GET requests,
  Supabase OpenAPI metadata, or read-only count/Auth lookups.
- **Mock-tested:** covered by in-memory API/Auth tests; this does not verify
  Supabase behavior.
- **Owner-reported:** recorded in prior project documents as an owner
  statement, not independently confirmed.
- **Unverified:** not established by accessible source or permitted read-only
  checks.

### Read-only actions and safety

- `GET /health`, `GET /api/collections`, and `GET /api/products` were checked
  through a loopback-only instance of the backend.
- Unauthenticated GET requests were made to protected admin endpoints.
- Supabase OpenAPI metadata and exact row counts were read. The `admin_users`
  query returned only a count and user IDs internally; no ID, email, or other
  identity was printed. The one referenced Auth user was checked without
  printing its profile.
- The backend test suite and JavaScript syntax checks were run locally.
- No database writes, RPC function calls, login attempts, or password
  operations were performed.

## 2. Executive findings

| Area | Audit result |
|---|---|
| Storefront | Existing design is still HTML/CSS/Vanilla JavaScript. Catalogue and product pages call backend APIs. Cart is local-storage-backed, but catalogue and orders are not. The search button now routes searches through the existing product API and product-card renderer; “Explore Fabrics” points to the collections section. |
| Admin Authentication | Password login, persistent Supabase session restoration, logout, backend JWT verification, and `is_admin()` checks are implemented. The live `admin_users` row maps to an Auth user, but no owner login or live `is_admin()` check was made. |
| Admin Panel | Collection, product, image URL, variant, enquiry, and order management screens exist. Admin database operations go through protected backend routes. Full UI CRUD was not exercised against live Supabase. |
| Backend/API | Express API exposes public catalogue and enquiry/order creation endpoints, plus protected admin management and order confirmation endpoints. Validation, CORS allow-listing, JSON-size limits, and rate limits exist. |
| Supabase | OpenAPI metadata was reachable (HTTP 200); all eight expected tables and three RPC names were exposed. Exact read-only counts: one `admin_users` row; zero rows in the other seven tables. |
| Database security/business logic | Public table columns and several FK relationships are documented. RLS, policy definitions, constraints, FK actions, function bodies, return types, ownership, and grants cannot be verified from the accessible metadata. |
| Testing | `npm.cmd test`: **49 passed, 0 failed, 0 skipped**. JavaScript syntax checks passed. These tests are mock-backed, not live integration tests. |
| Deployment | Frontend config currently points its API base URL to `http://localhost:5000`; backend CORS is configured for the local frontend origin. A deployed site needs the real HTTPS API origin and matching CORS configuration. |

## 3. Frontend audit

### Implemented and verified in source

- `index.html` is the storefront landing page and retains the original
  non-React design. `collection.html` renders the collection/product view.
- `script.js` loads active collections through `GET /api/collections`.
- `collection.js` loads a collection and its products/variants through the
  collection APIs. It renders available size/colour/price choices and uses
  each variant's database UUID.
- Product and collection images are loaded from existing database image URL
  fields; product cards fall back to a collection cover URL when needed.
- `store-data.js` persists **cart data only**. Cart entries contain the
  variant UUID, product display information, selected size/colour, quantity,
  and a stock snapshot. No catalogue or successful order is stored there.
- Checkout validates customer name/phone and quantity, submits customer fields
  plus variant UUID/quantity to `POST /api/orders`, prevents concurrent submits
  in the page, and displays the returned Order ID after success. This is
  mock/code-verified, not live order-verified.
- The custom-work enquiry form submits to `POST /api/enquiries`; client-side
  phone validation and response/error feedback are implemented.
- `styles.css` contains desktop/mobile responsive rules and reduced-motion
  handling. The established design was not migrated to React.

### Incomplete or blocked

- **No real catalogue data:** live active catalogue reads returned zero
  collections, products, or variants. Real checkout cannot be completed until
  valid product variant UUIDs and stock exist.
- **No local product image assets** were found in the workspace. The landing
  hero references an externally hosted image; owner-approved product/brand
  images or URLs are still needed.
- **Cloudinary is not integrated.** The current schema includes nullable
  `product_images.cloudinary_public_id`, but existing image URL fields remain
  usable. Cloudinary is deferred, not simulated.
- The four frontend issues identified in the initial audit (search, the
  “Explore Fabrics” target, the Admin email prefill, and misleading Admin
  labels) were addressed in the follow-up recorded in Section 14.
- `collection.js` provides no explicit image placeholder when both product
  image and collection cover URLs are absent; no image behavior could be
  checked against real records.
- `supabase-config.js` has the expected `url`, `publishableKey`, and
  `apiBaseUrl` fields. The Supabase URL is HTTPS, while the current API origin
  is local HTTP. This is appropriate only for local development; it is not a
  production frontend configuration.

### WhatsApp behavior

The source calls `window.open()` and creates a “Continue in WhatsApp” link
after a successful API order response. That source behavior is not a live
integration result. WhatsApp was not separately exercised in this fresh audit.

## 4. Admin Authentication audit

### Implementation

- `admin-auth-entry.mjs` loads the Supabase JS client from `esm.sh` and starts
  the page.
- Supabase Auth uses email/password login, `persistSession: true`,
  `autoRefreshToken: true`, and URL session detection.
- On login and page restore, `admin-auth.js` obtains the current session and
  sends its access token as a Bearer token to `GET /api/admin/session`.
- Backend `requireAuthenticatedUser` verifies the token through Supabase
  Auth's `getUser(token)`.
- `adminController.getSession` calls `is_admin()` using a client configured
  with the public key plus the verified user's JWT. Access is granted only
  when the RPC returns boolean `true`.
- A 401/403 results in sign-out and the login view; logout calls Supabase
  `signOut()`. Passwords are not stored in app code or local storage.
- Protected admin API requests retrieve the persisted session and attach its
  Bearer token. Admin catalogue/enquiry routes perform both user authentication
  and administrator-membership authorization.

### Live verification

- **Verified—live read-only:** there is one row in `admin_users`, and the
  referenced `user_id` resolves to one existing Supabase Auth user. No identity
  data was printed.
- This confirms a record-to-Auth-user mapping, **not** that the user is the
  intended owner, that login credentials work, or that `is_admin()` currently
  returns true for that session.
- **Verified—live read-only:** unauthenticated GETs to
  `/api/admin/session`, `/api/admin/catalogue`, and `/api/admin/orders` returned
  HTTP 401.
- **Mock-tested:** valid login/session restoration/logout flows, invalid
  credentials, unverified email, missing session, non-admin denial, and
  network failure.
- No owner password was requested, used, changed, or reset. The owner must
  perform a live login locally if that verification is desired.

## 5. Admin Panel audit

### Implemented

- `admin.html`, `admin.js`, and `admin.css` provide owner login, dashboard
  navigation, product/collection forms, product variant forms, enquiry
  management, and the orders table.
- Admin catalogue data is fetched from `GET /api/admin/catalogue` after the
  backend session is authorized.
- Collections support create/edit, active/inactive toggling, slug,
  description, cover image URL, and sort order.
- Products support create/edit, collection association, name/slug/description,
  active/featured flags, sort order, and optional image URL/alt text.
- Variants support create/edit, SKU, nullable size/colour, price, stock, and
  active state.
- Deactivate operations use `DELETE` API routes that set `is_active=false`;
  they do not delete rows. There is no permanent delete behavior.
- Enquiries are listed from Supabase; status options in the client are
  `new`, `contacted`, and `resolved`.
- Orders are fetched from the protected API only. The table retains exactly
  nine columns: Order ID, Customer Name, Customer Phone, Product Summary,
  Total Items, Total Amount, Stock Deducted, Order Details, Action.
- Order confirmation is protected, and the UI checks the refreshed
  `stock_deducted` field before reporting confirmation.

### Incomplete or unverified

- Full Admin UI CRUD was not browser-tested against real Supabase records.
  Backend tests cover authorization and representative catalogue/enquiry
  operations, not every UI path or every route combination.
- No image delete endpoint/control exists. Blank image URL on product edit
  does not remove a previously stored image row.
- Enquiry status values are code-supported, but their compatibility with a
  live database CHECK constraint is unverified.
- The dashboard loads orders, enquiries, collections, and products in
  parallel; records are not paginated.
- The owner identity and live `is_admin()` result remain unverified despite the
  one existing Auth mapping.

## 6. Backend and API audit

All API responses use a `{ success, message, data }` shape. The backend accepts
JSON up to 32 KB, disables the Express `x-powered-by` header, uses an exact
`FRONTEND_URL` CORS allow-list, and allows `GET`, `POST`, `PUT`, `PATCH`,
`DELETE`, and `OPTIONS` with `Content-Type` and `Authorization` headers.

### Endpoint inventory

| Method and path | Access | Purpose and validation |
|---|---|---|
| `GET /health` | Public | Health response; returned success during this audit. |
| `GET /api/collections` | Public | Active collections, sorted by sort order/name. |
| `GET /api/collections?include=products` | Public | Active collections with active products. |
| `GET /api/collections/:collectionId` | Public | Active collection by UUID or slug. |
| `GET /api/collections/:collectionId/products` | Public | Active products with images and active variants. |
| `GET /api/products` | Public | Active products with images and active variants. |
| `GET /api/products?collection=<UUID-or-slug>` | Public | Active products for a collection. |
| `GET /api/products?search=<text>` | Public | Search product name/description; max search length 100. |
| `GET /api/products/:productId` | Public | Active product by UUID or slug. |
| `POST /api/orders` | Public guest checkout; rate-limited | Validates customer name (1–120 chars), phone (7–25 allowed characters), 1–50 distinct UUID variants, and integer quantity 1–1000. Only customer name, phone, and `{variantId, quantity}` items are accepted; client prices are rejected. Rate limit: 10 requests/15 minutes. |
| `POST /api/orders/:orderId/confirm` | Authenticated administrator | Verifies Bearer token and `is_admin()`, then invokes `confirm_order` with the user's JWT. |
| `POST /api/enquiries` | Public; rate-limited | Validates name (1–120), phone, optional email, and message (1–5000); sets `status` to `new`. Unsupported fields are rejected. Rate limit: 15 requests/15 minutes. |
| `GET /api/admin/session` | Authenticated administrator | Verifies user and administrator status through `is_admin()`. |
| `GET /api/admin/orders` | Authenticated administrator | Reads orders and related order items after administrator verification. |
| `GET /api/admin/catalogue` | Authenticated administrator | Returns active and inactive collections/products, images, and variants. |
| `POST /api/admin/collections` | Authenticated administrator | Creates a collection; validates name, slug, image URL, active flag, and sort order. |
| `PUT /api/admin/collections/:collectionId` | Authenticated administrator | Updates supported collection fields. |
| `DELETE /api/admin/collections/:collectionId` | Authenticated administrator | Soft-deactivates the collection (`is_active=false`). |
| `POST /api/admin/products` | Authenticated administrator | Creates a product associated with an existing collection UUID. |
| `PUT /api/admin/products/:productId` | Authenticated administrator | Updates supported product fields. |
| `DELETE /api/admin/products/:productId` | Authenticated administrator | Soft-deactivates the product. |
| `POST /api/admin/products/:productId/images` | Authenticated administrator | Adds an HTTP(S) `image_url` and optional alt text/sort order. |
| `PUT /api/admin/products/:productId/images/:imageId` | Authenticated administrator | Updates the image URL/alt text/sort order. No image DELETE route exists. |
| `POST /api/admin/products/:productId/variants` | Authenticated administrator | Creates variant with SKU, nullable size/colour, positive price, nonnegative integer stock, active flag. |
| `PUT /api/admin/products/:productId/variants/:variantId` | Authenticated administrator | Updates supported variant fields. |
| `DELETE /api/admin/products/:productId/variants/:variantId` | Authenticated administrator | Soft-deactivates the variant. |
| `GET /api/admin/enquiries` | Authenticated administrator | Lists customer enquiries. |
| `PATCH /api/admin/enquiries/:enquiryId` | Authenticated administrator | Updates status; accepted values are `new`, `contacted`, `resolved`. |

There is deliberately no `GET /api/orders/:id` endpoint; the API does not
currently provide customer authentication or a separate high-entropy order
access token. No public admin catalogue writes are exposed.

### Implementation notes and risk

- Backend order creation first verifies active variant UUIDs, passes only
  variant IDs/quantities to `create_order`, then reads the created order and
  its item snapshots.
- **Potential ambiguous-order failure:** if `create_order` commits an order but
  a follow-up order/item read fails, the controller returns an error instead
  of a normal order response. The generic error handler converts 5xx responses
  to “Something went wrong”; a customer may not know whether an order exists
  and could retry. No idempotency key is present. The live RPC and this failure
  mode were not tested; address it after reviewing the RPC contract without
  guessing at database behavior.
- `errorHandler` logs `error.message` for generic 5xx failures. No credential
  leak was observed, but this logging path is not generally redacted. Review
  upstream exception content before production.
- Backend admin catalogue/enquiry database access uses the server-only secret
  client after JWT and `is_admin()` checks. Order confirmation uses a
  publishable-key client carrying the verified administrator JWT.
- `backend/.env` is ignored and not tracked. It contains both the active
  `SUPABASE_SECRET_KEY` configuration name and an unused legacy
  `SUPABASE_SERVICE_ROLE_KEY` name; source code uses the secret-key variable,
  not the legacy one. Values are intentionally omitted.

## 7. Supabase and database audit

### Live read-only observations

- Supabase PostgREST OpenAPI endpoint responded HTTP 200.
- Current table counts:

| Table | Rows |
|---|---:|
| `collections` | 0 |
| `products` | 0 |
| `product_images` | 0 |
| `product_variants` | 0 |
| `admin_users` | 1 |
| `orders` | 0 |
| `order_items` | 0 |
| `enquiries` | 0 |

- Active storefront API reads also returned 0 collections, 0 products, and 0
  active variants.
- One `admin_users.user_id` resolved to an Auth user. The Auth user's identity
  was not disclosed. The SQL FK constraint to `auth.users.id` was not
  inspected.
- OpenAPI exposes the tables and the RPC paths shown below. OpenAPI does not
  supply the actual RPC bodies, ACLs, RLS policy definitions, or all catalog
  constraints.

### Tables and columns

Types, required/nullability, defaults, and columns below are based on live
PostgREST metadata, reconciled with
[DATABASE_SCHEMA_FINAL.md](./DATABASE_SCHEMA_FINAL.md). “Required” corresponds
to the metadata required-field list; it is not a substitute for direct
`pg_catalog` constraint inspection.

| Table | Columns (type; `?` means nullable; defaults shown where present) |
|---|---|
| `collections` | `id` uuid PK default `gen_random_uuid()`; `name` text; `slug` text; `description` text?; `cover_image_url` text?; `is_active` boolean default `true`; `sort_order` integer default `0`; `created_at`, `updated_at` timestamptz default `now()`. |
| `products` | `id` uuid PK default `gen_random_uuid()`; `collection_id` uuid FK; `name`, `slug` text; `description` text?; `is_active` boolean default `true`; `is_featured` boolean default `false`; `sort_order` integer default `0`; `created_at`, `updated_at` timestamptz default `now()`. |
| `product_images` | `id` uuid PK default `gen_random_uuid()`; `product_id` uuid FK; `image_url` text; `cloudinary_public_id` text?; `alt_text` text?; `sort_order` integer default `0`; `created_at` timestamptz default `now()`. |
| `product_variants` | `id` uuid PK default `gen_random_uuid()`; `product_id` uuid FK; `sku` text; `size`, `color` text?; `price` numeric; `stock` integer default `0`; `is_active` boolean default `true`; `created_at`, `updated_at` timestamptz default `now()`. |
| `admin_users` | `user_id` uuid PK; `created_at` timestamptz default `now()`. A live row resolves to an Auth user; declared FK to `auth.users` is unverified. |
| `orders` | `id` uuid PK default `gen_random_uuid()`; `customer_name`, `customer_phone` text; `total_amount` numeric; `stock_deducted` boolean default `false`. No exposed `created_at` or textual order `status`. |
| `order_items` | `id` uuid PK default `gen_random_uuid()`; `order_id` uuid FK; `product_id`, `variant_id` uuid? and FK targets; `product_name` text; `selected_size`, `selected_color` text?; `quantity` integer; `product_price`, `line_total` numeric. |
| `enquiries` | `id` uuid PK default `gen_random_uuid()`; `customer_name`, `customer_phone`, `message`, `status` text; `customer_email` text?; `created_at` timestamptz default `now()`; `status` default `new`. |

### Verified public-schema relationships

- `products.collection_id` → `collections.id`
- `product_images.product_id` → `products.id`
- `product_variants.product_id` → `products.id`
- `order_items.order_id` → `orders.id`
- `order_items.product_id` → `products.id`
- `order_items.variant_id` → `product_variants.id`

Previous schema documentation records successful PostgREST embedding probes
for these relationships. `admin_users.user_id` → `auth.users.id` as a declared
database FK, FK delete/update actions, unique constraints, indexes, and
CHECK constraints remain **unverified**.

### RPC functions

| RPC | Exposed arguments/path | Backend use | Not verified |
|---|---|---|---|
| `create_order` | `POST /rpc/create_order`; `p_customer_name text`, `p_customer_phone text`, `p_items jsonb` | Public `POST /api/orders` calls it with customer fields and `{variant_id, quantity}` items; backend expects a returned order UUID. | Body, actual return type, transactional behavior, price/stock validation, active product/collection checks, row locking, grants, owner, security settings. |
| `confirm_order` | `POST /rpc/confirm_order`; `p_order_id uuid` | Protected `POST /api/orders/:orderId/confirm` calls using the verified administrator JWT. | Body, admin rule, stock deduction timing/atomicity, insufficient stock behavior, idempotency, grants, owner, security settings. |
| `is_admin` | `/rpc/is_admin`; no arguments exposed; OpenAPI lists GET and POST | Called with the authenticated user's JWT for admin authorization. Backend expects boolean `true`. | Body, actual return type, `auth.uid()`/table lookup, RLS interaction, execute grants, owner, search path, security-definer setting. |

### RLS, constraints, and stock rules

- RLS enablement and policy definitions for the eight public tables are
  **unverified**. The project owner previously reported RLS was enabled on all
  eight tables; this remains an owner statement, not independent evidence.
- The SQL review files contain read-only `pg_catalog` queries for constraints,
  indexes, RLS flags/policies, function bodies, and function permissions. They
  are commented and were not executed.
- The seven empty business tables cannot establish that valid CHECK/UNIQUE
  constraints exist. Nonnegative prices/stock, positive quantities,
  `line_total = product_price * quantity`, unique slugs/SKUs, and image/variant
  multiplicity are unverified.
- `order_items.product_id` and `variant_id` are nullable. Historical snapshot
  behavior and FK delete actions need review before any schema change.
- Existing backend validation requires 1–50 distinct order variants and
  quantity 1–1000. Database-side enforcement is not verified.
- The project owner previously reported a possible `create_order` product-ID /
  variant-ID assignment defect. The function body was not available; the
  report remains **unconfirmed**. No SQL change was proposed or executed.
- No stock deduction or order confirmation was tested against Supabase.

## 8. Security and operational findings

### Positive controls

- No service-role/secret-key reference was found in the inspected browser
  source. The publishable key in the frontend configuration is intended to be
  public; no key value is included in this report.
- `backend/.env` is matched by `backend/.gitignore` and is not tracked.
- Backend checks the JWT through Supabase Auth and uses `is_admin()` before
  admin data operations. Missing-token access to admin endpoints returned
  HTTP 401.
- Enquiry and order requests are rate-limited and validated; JSON body size is
  capped; database error responses generally avoid returning raw Supabase
  details to clients.
- Frontend code stores only the cart in local storage, not secrets or
  successful order records.

### Items needing attention

- The local browser API URL is `http://localhost:5000`, and local CORS is set
  for `http://localhost:5500`. Production needs an HTTPS API origin and a
  matching exact allowed frontend origin.
- An unused legacy service-role environment variable name exists alongside
  the active backend secret-key variable in the ignored local `.env`; review
  and remove/rotate it if no longer required. No value was read into or
  included in this report.
- The owner email prefill identified in the initial audit has been removed;
  email/password authentication behavior is unchanged.
- General 5xx logging includes `error.message` without generic redaction;
  review possible upstream exception content.
- Browser code imports Supabase JS and icons from public CDNs. Availability and
  supply-chain controls for these third-party runtime dependencies have not
  been evaluated.
- The nested `backend/backend/` package manifest/lockfile appears redundant
  and self-referential relative to the active backend package. Confirm its
  purpose before removing it.
- Database RLS and function EXECUTE permissions remain unknown; API
  authorization does not prove direct PostgREST/RPC access is adequately
  restricted.

## 9. Testing and verification

### Automated tests

Command: `npm.cmd test` from `backend/`  
Runner: Node.js built-in `node --test`

| Result | Count |
|---|---:|
| Passed | 49 |
| Failed | 0 |
| Skipped | 0 |
| Cancelled | 0 |

Breakdown: 9 Admin Auth tests, 33 API tests, 4 order-table tests, and 3
Supabase configuration tests.

Coverage includes mock authentication/session/logout, admin/non-admin
authorization, catalogue and enquiry validation, order payload/variant
validation, mocked stock failures, order response mapping, no public order
lookup, nine-column table ordering, and backend key-client construction. These
are **mock tests** and do not verify live RPC/RLS/database behavior.

JavaScript syntax checks passed for top-level frontend `.js`/`.mjs` files and
backend `src` and `test` JavaScript files.

The Phase 1 report records previous browser mock checks for catalogue/cart,
mock order ID display/cart clearing, and enquiry feedback. They were not
repeated during this fresh audit. No frontend automated test runner exists in
the workspace.

### Live read-only checks from this audit

- `GET /health`: successful.
- `GET /api/collections`: 0 active collections.
- `GET /api/products`: 0 active products and 0 active variants.
- `GET /api/admin/session`: 401 without a Bearer token.
- `GET /api/admin/catalogue`: 401 without a Bearer token.
- `GET /api/admin/orders`: 401 without a Bearer token.
- Supabase PostgREST OpenAPI: HTTP 200.
- Exact table counts: 1 `admin_users` row; 0 rows in the other seven listed
  tables.
- Admin-user Auth lookup: 1 row maps to an existing Auth user; identity
  withheld. No login or `is_admin()` RPC was performed.

## 10. Completed, incomplete, unverified, and owner-dependent work

### Implemented / mock-verified

- Vanilla storefront and responsive styling.
- Backend-backed active catalogue reads and product variant rendering.
- Local cart containing variant UUID, options, quantity, and stock snapshot.
- Backend order and enquiry request paths with client validation.
- Admin Auth/session flow and backend JWT/admin checks.
- Protected collection/product/image/variant/enquiry admin APIs and controls.
- Supabase-only Orders dashboard with the required nine columns.
- Backend validation, CORS, body size limit, and rate limiting.

### Incomplete or blocked

- Production frontend API configuration and matching deployment CORS.
- Real active catalogue records and valid variant UUIDs.
- Real product/brand images or owner-approved image URLs.
- Live owner login/admin authorization check.
- Live admin CRUD, enquiry, order, and confirmation tests.
- Confirmation that live RPC rules produce correct snapshots and safely deduct
  stock once.
- Confirmation that enquiry statuses match database constraints.
- Run a complete browser-level search check against a functioning mock API;
  the attempted browser verification in this follow-up was inconclusive.
- Resolve ambiguous post-RPC order-read failure/retry behavior after reviewing
  database function behavior.
- RLS, CHECK/UNIQUE constraints, indexes, FK actions, function definitions,
  ownership, security settings, and grants.

### Owner/business dependencies

- Supply/approve collection names/slugs, product names/descriptions, prices,
  variant sizes/colours/SKUs, and stock values. Do not invent these records.
- Supply owner-approved product images or usable image URLs and confirm rights
  to use the current external hero image. Cloudinary can remain deferred.
- Identify the production backend HTTPS URL and frontend origin for deployment.
- Have the owner sign in locally to verify their own account; do not send the
  password to the development team or chat.
- Provide sanitized, read-only SQL catalog output for RLS policies,
  constraints, FK actions, and the three RPC definitions/owners/settings/ACLs.
- Approve a safe, non-production test procedure before any live database
  writes. No approval or write was assumed.
- Confirm business rules for status transitions, stock confirmation, and
  whether existing soft-deactivation behavior meets operational needs.

## 11. Top 10 pending tasks, priority order

1. **Verify database security and order logic:** obtain sanitized read-only
   definitions/ACLs for `create_order`, `confirm_order`, and `is_admin`; inspect
   RLS policies, constraints, indexes, and FK actions. Do not modify SQL before
   this evidence and explicit approval.
2. **Configure deployment endpoints:** provide the actual HTTPS backend URL
   and deployed frontend origin; replace local-only API/CORS configuration in
   the deployment environment and verify read-only health/catalogue requests.
3. **Verify the owner account without sharing credentials:** owner performs a
   local login; confirm backend JWT validation and live `is_admin()` result.
   The existing `admin_users` row/Auth-user mapping alone is insufficient.
4. **Create real catalogue content safely:** in a non-production project,
   owner supplies/approves collection and product fields, UUID-backed variants,
   prices, and stock; only then test live admin CRUD with prior approval.
5. **Supply approved images:** provide local assets or ordinary image URLs and
   approve the hero image. Keep Cloudinary deferred unless separately
   authorized.
6. **Test full Admin CRUD paths:** add focused tests for collection create/edit,
   product create/edit, image create/update, variant create/update, deactivation,
   and enquiry list/status update, then exercise the UI with controlled mocks.
7. **Complete browser-level search verification:** exercise search results,
   empty results, and API errors with a controlled mock API; the implementation
   is in place, but the browser check did not produce conclusive results.
8. **Run non-production end-to-end order tests:** after function review and
   approval, test real variant IDs, stock validation, order snapshots,
   confirmation, insufficient stock, duplicate confirmation, and safe retry
   behavior.
9. **Validate enquiry workflow:** confirm the live status constraint and test
   submission, admin listing, and allowed status updates in the test project.
10. **Production readiness review:** verify HTTPS/CORS/CDN behavior, ensure
    unused legacy credentials are retired safely, and repeat only approved
    read-only and staged checks before launch.

## 12. Recommended next development step

The next step that needs no product data or database writes is to complete a
browser-level check of search against a controlled mock API, then proceed with
production API configuration and sanitized database function/RLS evidence.
Do not attempt live order or stock tests until a safe non-production procedure
is approved.

## 13. Final executive summary

- **Already completed:** Vanilla storefront/Admin code paths; backend APIs for
  catalogue, orders, enquiries, and admin operations; Supabase Auth/JWT/admin
  authorization architecture; cart variant UUID flow; nine-column Supabase
  Orders UI; 49 passing mock tests and JavaScript syntax checks.
- **Still pending:** production API configuration, live owner sign-in and
  admin check, live CRUD/enquiry/order tests, verified database security and
  RPC behavior, and final deployment verification.
- **Blocked by real product data/images:** end-to-end real catalogue browsing
  and order checkout; active catalogue is empty and no local product images
  exist. The owner must supply real product/variant data and approved images.
- **Blocked by business-owner input:** catalogue data/prices/stock, approved
  photos/image rights, production URL/origin, business status/stock rules,
  sanitized database function/RLS evidence, and prior approval of any
  non-production database write test. The owner password is not required in
  chat; the owner can enter it locally for live verification.
- **Can proceed immediately without business data:** finish browser-level
  verification of the frontend search states, review error-log sanitization,
  and prepare deployment configuration once the public API origin is supplied.

**Final status: PARTIALLY COMPLETE / BLOCKED.** Mock success and an existing
Auth-user mapping do not establish live admin authorization, valid order
creation, or safe stock deduction. No database write or schema change was
performed. Cloudinary remains deferred.

## 15. Live Supabase security metadata follow-up — 2026-11-17

### Access and safety

The requested direct PostgreSQL metadata audit could not be performed because
no PostgreSQL/Supabase SQL session or compatible client was available to the
reviewer. Its local availability check found `psql`, `supabase`, and `pgcli`
unavailable; `sqlcmd` was available but is not a PostgreSQL client. No SQL
query was executed, no RPC was invoked, and no database, application, or
environment change was made. Credentials and secret values were not accessed
or disclosed.

The prior audit's read-only checks were not repeated. In particular, this
follow-up does not repeat the prior PostgREST metadata, table-count, or
unauthenticated API checks.

### Requested evidence and result

| Requested verification | Evidence/result | Severity | Recommendation |
|---|---|---|---|
| RLS enabled state and actual policies for `collections`, `products`, `product_images`, `product_variants`, `admin_users`, `orders`, `order_items`, and `enquiries` | **UNVERIFIED** — direct database catalog evidence was inaccessible. | Unknown; no issue confirmed or ruled out. | Obtain sanitized read-only catalog results through an authorized PostgreSQL session. |
| `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions for all eight tables | **UNVERIFIED** — table ACLs and role grants were not queried. | Unknown; no issue confirmed or ruled out. | Inspect table privileges for the relevant roles using read-only metadata queries. |
| Foreign keys and delete actions; `UNIQUE`/`CHECK` constraints; indexes | **UNVERIFIED** — database constraint and index catalogs were not queried. Prior PostgREST relationship metadata does not establish these details. | Unknown; no issue confirmed or ruled out. | Obtain sanitized FK, constraint, and index metadata from the database catalog. |
| Actual definitions and logic of `create_order()`, `confirm_order()`, and `is_admin()` | **UNVERIFIED** — function bodies were inaccessible; none were executed. Product/variant ID mapping, price/quantity validation, stock deduction, and admin authorization could not be checked. | Unknown; no issue confirmed or ruled out. | Obtain sanitized function definitions for source review; do not invoke the functions as part of this audit. |
| Function owner, `SECURITY DEFINER`/`INVOKER`, `search_path`, and `EXECUTE` grants for `PUBLIC`, `anon`, `authenticated`, and `service_role` | **UNVERIFIED** — routine metadata and execute ACLs were not queried. | Unknown; no issue confirmed or ruled out. | Inspect routine metadata and ACLs with read-only catalog queries. |

### Assessment

No new database vulnerability is confirmed by this follow-up. This is not
evidence that the database is secure: all requested database-security details
remain **UNVERIFIED** because direct metadata access was unavailable. The live
Supabase security audit is **INCOMPLETE**. No fixes were made.

## 14. Frontend follow-up — four requested fixes

The following targeted changes were made without changing the existing
HTML/CSS/Vanilla JavaScript architecture, backend routes, database, or Admin
Orders table:

- The existing Search button opens a search form. Empty/whitespace input gets
  inline feedback; a valid term is URL-encoded and sent to the collection page.
  `storefront-api.js` calls the existing
  `GET /api/products?search=<term>` endpoint. `collection.js` displays returned
  products through its existing product-card renderer and cart-add flow, and
  handles no matches and API failures with visible messages.
- “Explore Fabrics” now targets the existing collections section through
  `id="fabrics"`.
- The prefilled email value was removed from the Admin login form. Supabase
  email/password authentication code was not changed.
- “Admin demo” was changed to “Admin”; Admin enquiry headings now say
  “Customer enquiries” and clarify that only website form submissions are
  stored. The Admin Orders table remains unchanged at nine columns.

### Files changed

- `index.html`
- `script.js`
- `storefront-api.js`
- `collection.html`
- `collection.js`
- `admin.html`

### Verification

- Backend mock tests: **49 passed, 0 failed, 0 skipped, 0 cancelled** using
  `npm.cmd test` from `backend/`.
- `node --check` passed for all three modified JavaScript files:
  `script.js`, `collection.js`, and `storefront-api.js`.
- Source review confirmed the search API path, UI states, anchor target,
  removal of the prefilled email, updated enquiry wording, and removal of the
  “Admin demo” label.
- A browser check was attempted with local mock responses, but the browser
  session did not complete the rendered search-result assertions. Therefore
  search success/no-result/API-error behavior is **implemented and
  code-reviewed, but not browser-verified** in this follow-up. No live
  Supabase/API write or live integration check was performed.
- These frontend changes do not alter the previous live audit findings: the
  catalogue is empty, owner login and `is_admin()` remain unverified, and
  database/RLS/RPC behavior remains unverified. Cloudinary remains deferred.
