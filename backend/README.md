# Shruthi's Couture API

This is a separate Express backend for the existing static HTML/CSS/vanilla
JavaScript storefront. It does not serve the frontend. Its admin routes verify
Supabase Auth users against the existing `is_admin()` function before returning
database orders.

## Requirements

- Node.js 20 or newer
- A Supabase project whose schema includes the tables and the `create_order`,
  `confirm_order`, and `is_admin` functions described below

## Local setup

1. Copy `backend\.env.example` to `backend\.env` (PowerShell:
   `Copy-Item backend\.env.example backend\.env`).
2. Install dependencies from `backend`. On Windows PowerShell, use
   `npm.cmd install` if the `npm` script is blocked by execution policy.
3. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `PORT`, and `FRONTEND_URL` in `.env`. `SUPABASE_URL` must be the base project
   URL (for example `https://your-project-id.supabase.co`, without
   `/rest/v1/`). Use the Supabase Secret API key only in this server-side
   environment; never add it to frontend JavaScript or source control. The
   publishable key is used by the authenticated confirmation RPC client and is
   not a substitute for the server secret used by existing backend operations.
   `SUPABASE_ANON_KEY` is also accepted as a legacy name for the public key.
4. Start the server with `npm.cmd start`, or use `npm.cmd run dev` during
   development on Windows PowerShell (`npm start` / `npm run dev` elsewhere).
5. Check `GET http://localhost:5000/health`.

The server loads `backend/.env` relative to `src/server.js`, even if the
command is launched from the repository root. The key variable is named
`SUPABASE_SECRET_KEY`; no legacy `SUPABASE_SERVICE_ROLE_KEY` variable is used.

`FRONTEND_URL` is an exact allowed origin, or a comma-separated list of exact
origins. For local static development, set it to the origin actually used by
the local server (for example `http://localhost:5500`). Netlify deployments
should use the exact deployed HTTPS origin, without a path. Non-HTTPS origins
are accepted only for localhost development.

## Production backend hosting

The Express API must run as a Node.js service; Netlify static hosting does not
run `src/server.js`. Configure the backend host's root directory as the outer
`backend` folder (the one containing this README and `package.json`), use
Node.js 20 or newer, install with `npm ci`, and start with `npm start`.

Set these variables in the backend host's private environment settings:
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`PORT`, and `FRONTEND_URL`. Use the host-provided `PORT` when available.
`FRONTEND_URL` must be the exact deployed HTTPS frontend origin (or a
comma-separated list of approved HTTPS origins). Do not copy the local `.env`,
the unused legacy `SUPABASE_SERVICE_ROLE_KEY`, or any server secret into the
frontend deployment. The Netlify build requires `COUTURE_API_BASE_URL` to be
set to this same HTTPS backend origin in the Netlify build environment; the
build publishes only the allow-listed frontend files to `dist`.

## API

All responses use `{ "success": boolean, "message": string, "data": ... }`.

### Collections

- `GET /api/collections` — active collections sorted by `sort_order`.
- `GET /api/collections?include=products` — also includes active products per
  collection.
- `GET /api/collections/:collectionId` — active collection by UUID or slug.
- `GET /api/collections/:collectionId/products` — its active products,
  images, and active variants.
- Public storefront pages use these Supabase-backed APIs; browser-local demo
  collections and products are no longer used.

### Products

- `GET /api/products` — active products with images and active variants.
- `GET /api/products?collection=<UUID-or-slug>` — filter by collection.
- `GET /api/products?search=<text>` — search product name and description.
- `GET /api/products/:productId` — active product by UUID or slug.

### Orders

`POST /api/orders` accepts:

```json
{
  "customerName": "Customer Name",
  "customerPhone": "+919999999999",
  "items": [
    {
      "variantId": "33333333-3333-4333-8333-333333333333",
      "quantity": 1
    }
  ]
}
```

The backend sends only variant IDs and quantities to the `create_order` RPC.
The request must contain 1–50 items with distinct variant IDs, and each
quantity must be an integer from 1 through 1000.
The database function must load current product/variant data, validate
availability, calculate totals, and snapshot prices and selected options.
Client-provided prices and totals are rejected. The order response contains
the database-generated order UUID and its returned item snapshots. The
storefront submits only actual variant UUIDs and quantities, then opens
WhatsApp after the backend returns the created order. Successful orders are
not copied into browser storage.
Variant size and colour may be `NULL` for products that do not use those
options; any non-NULL selected values are returned from the variant and saved
as order-item snapshots.

There is deliberately no `GET /api/orders/:id`: the schema has no customer
authentication or verification token, and an order UUID alone should not be
used to expose private order details. A secure lookup can be added later with
customer authentication or a high-entropy, hashed order access token.

`POST /api/orders/:orderId/confirm` requires a Supabase Auth access token in
the `Authorization: Bearer <access-token>` header. The backend verifies the
token with Supabase Auth, verifies administrator membership with `is_admin()`,
then calls `confirm_order` using a client configured with the publishable key
and that same user's JWT. The service-role client is not used for this RPC.
The live function still needs verification for stock atomicity and idempotency.

`GET /api/admin/session` and `GET /api/admin/orders` require the same Bearer
token. The session endpoint calls `is_admin()` using the verified user's JWT.
The order endpoint performs that check before reading `orders` and
`order_items` with the server-only Supabase client. Non-admin users receive
403 responses. Database order status is limited to the existing
`stock_deducted` field; the dashboard offers confirmation but does not invent
completed or cancelled states for database orders.

### Enquiries

`POST /api/enquiries` accepts `customerName`, `customerPhone`,
`customerEmail` (optional), and `message`. The backend sets the status to
`new`. The current `enquiries` table does not store `inquiryType`,
`collectionId`, or `productId`; requests containing those fields are rejected
with a validation error rather than silently discarding their values. Support
for enquiry categories or product/collection context requires an approved
database storage contract.

### Admin catalogue and enquiries

These endpoints require both a Supabase Auth Bearer token and positive
`is_admin()` verification. The server-side secret remains in the backend.

- `GET /api/admin/catalogue` — all collections and products, including
  inactive entries, with image URLs and variants.
- `POST`, `PUT`, and `DELETE /api/admin/collections` — collection management.
  `DELETE /:collectionId` sets `is_active=false`; it does not delete the row.
- `POST`, `PUT`, and `DELETE /api/admin/products` — product management.
  `DELETE /:productId` also deactivates instead of deleting.
- `POST` / `PUT`
  `/api/admin/products/:productId/images[/:imageId]` — store or update normal
  HTTP(S) `image_url` values and alt text.
- `POST /api/admin/uploads/images` — upload one product image to Cloudinary.
  Requires an administrator Bearer token and `multipart/form-data` with the
  image in the `image` field. JPEG, PNG, and WebP files up to 5 MB are accepted.
  Returns `data.imageUrl` as the secure Cloudinary URL and `data.publicId`.
  This endpoint only uploads the image; it does not modify product records.
- `POST`, `PUT`, and `DELETE`
  `/api/admin/products/:productId/variants[/:variantId]` — manage SKU, nullable
  size/colour, price, stock, and active state. `DELETE` deactivates the
  variant.
- `GET /api/admin/enquiries` and `PATCH /api/admin/enquiries/:enquiryId` —
  list customer-submitted records and update a supported status.

Enquiry submission is public, rate-limited, and validates customer name, phone,
optional email, and message. A WhatsApp link click by itself is not stored as
an enquiry.

## Database prerequisites and stock behavior

The backend expects these tables and columns: `collections`, `products`,
`product_images`, `product_variants`, `orders`, `order_items`, and `enquiries`.
It expects an RPC function named `create_order` with parameters
`p_customer_name`, `p_customer_phone`, and `p_items`, where items contain
`variant_id` and `quantity`. That function must return the new order UUID.

The intended `create_order` contract is to validate stock and create order
snapshots without reserving or deducting stock. The live function definition
is not available in this repository or through the current API metadata, so
these behaviors are **NOT VERIFIED**. The project owner reports that the live
function currently assigns the product ID to the variant ID in its item-insert
loop; this reported defect also requires source verification before a
replacement definition can be safely prepared.

After an administrator confirms an order,
`POST /api/orders/:orderId/confirm` calls `confirm_order` with that
administrator's verified JWT; the database function checks admin membership
and should deduct stock atomically once. The live `confirm_order` and
`is_admin` definitions, grants, search paths, and security settings are not
available for verification. Since the intended creation flow does not reserve
stock, multiple pending orders can compete for the same inventory, and a later
confirmation may fail if stock is no longer available.

The database-managed function definitions are not checked into this workspace.
Review the live schema, RPC definitions, permissions, and behavior before
production use. Do not run write tests against production data; use a separate
Supabase test project for integration testing.

## Tests

Run `npm test` for isolated HTTP/API tests with an in-memory Supabase mock.
These tests verify endpoint responses, validation, the RPC payload, and that
the mock's stock value remains unchanged. They do not prove the actual
Supabase schema, RPC, RLS, stock behavior, or live database connection.

To test an image upload, start the backend and send an administrator's current
Supabase Auth access token with a multipart image file:

```powershell
curl.exe -X POST http://localhost:5000/api/admin/uploads/images `
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" `
  -F "image=@C:\path\to\product.png"
```

The response contains the Cloudinary `secure_url` in `data.imageUrl`. Keep all
three Cloudinary variables in `backend\.env`; never add them to frontend code.

## Admin login and frontend configuration

The existing `admin.html` page uses Supabase email/password authentication.
The owner signs in through Supabase Auth; the page restores the Supabase
session on refresh and verifies admin membership through
`GET /api/admin/session`. The dashboard is shown only after the backend verifies
the user's token and `is_admin()` result. Supabase's normal session storage is
used; passwords are not stored.

Configure the frontend in the repository-root `supabase-config.js`:

- `url`: Supabase project URL.
- `publishableKey`: Supabase publishable key, or the legacy anon key.
- `apiBaseUrl`: backend API origin (for local development,
  `http://localhost:5000`).

Only a publishable/anon key may be placed in this file. Never put
`SUPABASE_SECRET_KEY`, a service-role key, or any other server secret in
frontend files. Serve the static frontend over HTTP(S) rather than opening
`admin.html` directly as a file, and set backend `FRONTEND_URL` to that exact
origin.

The dashboard loads catalogue, enquiries, and orders from the backend after
admin authentication. Catalogue deactivation uses existing `is_active` fields
rather than deleting rows. The order table contains only Supabase orders and
retains its nine established columns. Enquiry status changes use `new`,
`contacted`, or `resolved`; confirm those values against the live database
constraint before production use. Database order confirmation sends the
current user's Bearer token to `POST /api/orders/:orderId/confirm`; the
frontend does not call the RPC directly.
