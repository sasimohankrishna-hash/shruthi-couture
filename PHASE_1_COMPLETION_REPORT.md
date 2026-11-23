# Shruthi's Couture — Phase 1 Completion Report

**Status: PARTIALLY COMPLETE / BLOCKED — do not mark Phase 1 complete.**

The in-scope frontend and backend flows have been implemented without replacing
the HTML/CSS/Vanilla JavaScript frontend or changing the database schema.
Mock tests and safe read-only checks pass, but production integration and
end-to-end behavior cannot be confirmed: the live catalogue currently has no
collections, products, or active variants, live writes were not approved, and
the database RPC definitions and policies are unavailable for review.

Cloudinary is explicitly deferred. Per the latest instruction, WhatsApp
handoff was left aside and was not part of the final browser verification.

## Status by feature

| Feature | Implementation and evidence | Remaining limitation |
|---|---|---|
| Admin authentication | Supabase Auth login/session restoration/logout are implemented. The backend verifies the access token and checks administrator membership before returning protected data. Covered by mock tests. | No live owner login, session restoration, or administrator-membership check was performed. |
| Admin catalogue | Protected backend APIs and dashboard flows support collections, products, image URLs/alt text, and variants (size, colour, SKU, price, stock, active state). Deactivation is non-destructive (`is_active=false`). Mock API tests cover authorization, validation, reads, and representative updates. | Full CRUD was not exercised against Supabase. No real catalogue entries are available to verify the admin UI end to end. |
| Storefront catalogue | Storefront requests active collections, products, images, and variants from the backend. A browser mock rendered a product and variant and added its actual mock variant UUID to the cart. | Live read-only responses contained zero collections, products, and active variants. No real product/variant selection was verified. |
| Cart and order creation | Cart items carry variant UUID, selected size/colour, and quantity. Checkout submits customer details and variant UUID/quantity to `POST /api/orders`; successful mock checkout rendered the returned mock Order ID and cleared the cart. Backend tests verify validation and that client prices are not sent. | No live order was created. Live stock, order snapshots, duplicate-submit behavior in a real checkout, and database-generated IDs remain unverified. WhatsApp handoff was set aside, not revalidated. |
| Enquiries | Public enquiry form submits validated customer fields to `POST /api/enquiries`; backend persists status `new`. Authorized admin APIs list enquiries and update supported statuses. Backend tests pass, and a browser mock verified the request and success display. | No live enquiry was submitted or fetched; live status constraints remain unverified. |
| Admin orders | Admin API returns database orders and related items after authentication and administrator authorization. The dashboard displays only database orders and preserves the required nine columns. Mock tests verify authorization, order aggregation, and column order. | No live orders were available to inspect. |
| Stock confirmation | Backend confirmation route verifies the administrator and forwards the user's JWT to `confirm_order`; tests cover the authorization flow and mock responses. | Live `create_order`/`confirm_order` definitions, grants, stock atomicity, insufficient-stock behavior, and duplicate-confirmation idempotency are not verified. No stock deduction was attempted. |
| Security | Secret configuration remains backend-only; frontend source scan found no service-role/secret-key references. `backend/.env` is ignored and not tracked. Protected admin endpoints reject unauthenticated requests in live read-only checks. | Live RLS policies, RPC grants/ownership, and function security settings could not be inspected. An obsolete `SUPABASE_SERVICE_ROLE_KEY` entry exists in the ignored local env file; backend source does not use it. |

## Verification results

### Mock-tested

- Backend test suite: **49 passed, 0 failed** (`npm.cmd test` from `backend/`).
- JavaScript syntax checks: passed for root frontend JavaScript/module files and
  backend source/test JavaScript files.
- Browser mocks: storefront collection/product/variant rendering and cart
  addition; mock order creation with returned Order ID and cart clearing; mock
  enquiry submission and success feedback.
- Mock responses are not evidence of live Supabase writes or live integration.

### Live read-only checks

- Backend health endpoint responded successfully.
- Active catalogue reads returned **0 collections, 0 products, and 0 active
  variants**.
- Unauthenticated requests to the admin catalogue and admin orders APIs
  returned **401**.
- No live login, database write, order, enquiry, or stock operation was
  performed.

### Code-reviewed, not live-verified

- Bearer-token validation and `is_admin()` checks guard admin catalogue,
  enquiry, order-list, and order-confirmation APIs.
- Order requests use server/database prices and actual variant identifiers;
  the browser does not submit prices or save successful orders as local demo
  orders.
- Catalogue “delete” controls deactivate records rather than deleting data.
- The Orders dashboard retains the nine requested columns.
- `.env` is ignored and untracked; no secret values are included in this
  report.

## Changed files

- Backend authorization and routes: [requireAdministrator.js](./backend/src/middleware/requireAdministrator.js), [adminCatalogueRoutes.js](./backend/src/routes/adminCatalogueRoutes.js), [adminRoutes.js](./backend/src/routes/adminRoutes.js), [orderRoutes.js](./backend/src/routes/orderRoutes.js), and [app.js](./backend/src/app.js).
- Backend catalogue/enquiry controller and tests: [adminCatalogueController.js](./backend/src/controllers/adminCatalogueController.js) and [api.test.js](./backend/test/api.test.js).
- Frontend admin experience: [admin.html](./admin.html), [admin.js](./admin.js), [admin.css](./admin.css), and [admin-auth-entry.mjs](./admin-auth-entry.mjs).
- Frontend storefront/API/cart: [storefront-api.js](./storefront-api.js), [store-data.js](./store-data.js), [script.js](./script.js), [collection.js](./collection.js), [index.html](./index.html), [collection.html](./collection.html), and [styles.css](./styles.css).
- Backend API documentation: [README.md](./backend/README.md).

## Pending work and blockers

1. Use a separate, non-production Supabase test project with known test
   collections/products/variants. Live record creation or modification remains
   subject to the user's required prior approval and a safe test procedure.
2. Obtain and review sanitized definitions and permissions for `create_order`,
   `confirm_order`, and `is_admin`, plus RLS policies. No SQL or schema change
   was made; proposing a function/schema change requires explaining the proven
   defect and getting approval first.
3. With the test project and approved procedure, verify live administrator
   login/session behavior, catalogue CRUD, enquiry create/list/status update,
   order creation with real variant UUIDs, confirmation and stock behavior,
   and unauthorized access.
4. Repeat the end-to-end checks against the intended deployment after the test
   project succeeds. Do not treat mocks or empty read-only responses as
   production integration verification.

**Final assessment:** Phase 1 is **PARTIALLY COMPLETE / BLOCKED**. The requested
code paths are implemented and mock-tested to the extent listed above, but
Phase 1 cannot be declared complete until the outstanding live checks pass.
Cloudinary remains deferred; WhatsApp was left aside for this verification.
