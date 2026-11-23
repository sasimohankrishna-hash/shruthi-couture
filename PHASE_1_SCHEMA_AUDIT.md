# Phase 1 — Database Schema Audit

**Project:** Shrithi Couture  
**Audit date:** 2026-11-16  
**Status:** **NOT COMPLETE** — schema metadata and the nine Orders display
requirements are known, but constraints, RLS policies, function
bodies/permissions, and FK actions require database-catalog access.

## Evidence and limits

- Read the live Supabase PostgREST OpenAPI metadata using the configured
  server-side key. The key and database rows were not included in this report.
- A fresh read-only OpenAPI request again exposed the eight known table
  columns and RPC paths/arguments, but not SQL function definitions, grants,
  function owners, or RLS policies.
- Read-only relation probes used `limit=0`; they returned no row data.
- Anonymous `limit=0` probes returned HTTP 200 for the eight tables. That
  result does **not** establish whether RLS is enabled or which policies exist.
- No pre-existing executable SQL schema/function/policy scripts or migrations
  were found in this workspace. The comments-only review stub created with this
  report contains no DDL.
- The project has no available database-catalog or Supabase Management API
  evidence for indexes, check/unique constraints, RLS policies, function
  definitions, or function ACLs. PostgREST metadata cannot verify those items.
- `backend/.env` contains Supabase API configuration but no database connection
  string or Management API access token. Neither `psql` nor the Supabase CLI is
  installed in this environment. No secret values were printed.
- Read-only exact-count requests using the server-side key returned one row in
  `admin_users` and zero rows in each of `collections`, `products`,
  `product_images`, `product_variants`, `orders`, `order_items`, and
  `enquiries`. These were counts only; no row values were retrieved.
- Read-only violation-count probes found zero visible rows for nonpositive
  variant prices, negative variant stock, order-item quantities outside
  1–1000, nonpositive order-item prices/line totals, null historical product or
  variant references, and nonpositive order totals. The seven relevant tables
  are currently empty, so this does not prove that database constraints exist.
- Nullability below is taken from the generated OpenAPI required-field lists.
  Defaults are taken from the same metadata. A missing default does not imply
  that application code or a trigger supplies one.

## 1. Table-by-table schema audit

`NOT NULL` below means the field appears in the PostgREST response-required
list. Fields marked `NULL` do not appear in that list.

### `collections` — **PASS for columns and primary key**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL |
| `description` | text | NULL |
| `cover_image_url` | text | NULL |
| `is_active` | boolean | NOT NULL, `true` |
| `sort_order` | integer | NOT NULL, `0` |
| `created_at` | timestamptz | NOT NULL, `now()` |
| `updated_at` | timestamptz | NOT NULL, `now()` |

No foreign key is listed for this table. Unique constraints on `slug`, other
indexes, check constraints, and any `updated_at` trigger are **NOT VERIFIED**.

### `products` — **PASS for columns and collection relationship**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `collection_id` | uuid | NOT NULL, FK to `collections.id` |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL |
| `description` | text | NULL |
| `is_active` | boolean | NOT NULL, `true` |
| `is_featured` | boolean | NOT NULL, `false` |
| `sort_order` | integer | NOT NULL, `0` |
| `created_at` | timestamptz | NOT NULL, `now()` |
| `updated_at` | timestamptz | NOT NULL, `now()` |

The FK is described by live OpenAPI metadata and the collection-to-products
embedding probe succeeded. Unique constraints, FK delete/update actions,
indexes, checks, and update triggers are **NOT VERIFIED**.

### `product_images` — **PASS for required image mapping**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `product_id` | uuid | NOT NULL, FK to `products.id` |
| `image_url` | text | NOT NULL |
| `cloudinary_public_id` | text | NULL |
| `alt_text` | text | NULL |
| `sort_order` | integer | NOT NULL, `0` |
| `created_at` | timestamptz | NOT NULL, `now()` |

The product-to-images embedding probe succeeded. Multiple images are supported
by the backend's one-to-many handling, but the absence of a unique constraint
on `product_id` could not be verified.

### `product_variants` — **PASS for optional size/colour and stock fields**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `product_id` | uuid | NOT NULL, FK to `products.id` |
| `sku` | text | NOT NULL |
| `size` | text | NULL |
| `color` | text | NULL |
| `price` | numeric | NOT NULL |
| `stock` | integer | NOT NULL, `0` |
| `is_active` | boolean | NOT NULL, `true` |
| `created_at` | timestamptz | NOT NULL, `now()` |
| `updated_at` | timestamptz | NOT NULL, `now()` |

The live schema supports variants with no size, no colour, or neither. Price
and stock types match backend expectations. The product-to-variants embedding
probe succeeded. SKU uniqueness, nonnegative-price/stock checks, other indexes,
and update triggers are **NOT VERIFIED**.

### `admin_users` — **PARTIAL**

| Column | Type | Nullability / default |
|---|---|---|
| `user_id` | uuid | NOT NULL, primary key |
| `created_at` | timestamptz | NOT NULL, `now()` |

The primary key is verified. A foreign key from `user_id` to `auth.users.id`
and its delete behavior are **NOT VERIFIED**; `auth.users` is outside the
public API schema metadata inspected here. RLS and policies are also
**NOT VERIFIED**.

### `orders` — **PASS for requested base fields**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `customer_name` | text | NOT NULL |
| `customer_phone` | text | NOT NULL |
| `total_amount` | numeric | NOT NULL |
| `stock_deducted` | boolean | NOT NULL, `false` |

`id` is a unique Order ID because it is the primary key. There is no
`created_at` or textual `status` column in the exposed schema. Indexes,
nonnegative-total checks, RLS, and other constraints are **NOT VERIFIED**.

### `order_items` — **PARTIAL; snapshot fields exist**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `order_id` | uuid | NOT NULL, FK to `orders.id` |
| `product_id` | uuid | NULL, FK to `products.id` |
| `variant_id` | uuid | NULL, FK to `product_variants.id` |
| `product_name` | text | NOT NULL |
| `selected_size` | text | NULL |
| `selected_color` | text | NULL |
| `quantity` | integer | NOT NULL |
| `product_price` | numeric | NOT NULL |
| `line_total` | numeric | NOT NULL |

The order-to-items, items-to-products, and items-to-variants embedding probes
succeeded. The nullable product and variant references may be intentional for
historical snapshots, but the confirmation workflow may depend on
`variant_id`; the intended deletion and nullability behavior needs confirmation.
Quantity checks, price/line-total consistency, FK actions, indexes, and RLS are
**NOT VERIFIED**.

### `enquiries` — **PASS for backend-supported fields**

| Column | Type | Nullability / default |
|---|---|---|
| `id` | uuid | NOT NULL, primary key, `gen_random_uuid()` |
| `customer_name` | text | NOT NULL |
| `customer_phone` | text | NOT NULL |
| `customer_email` | text | NULL |
| `message` | text | NOT NULL |
| `status` | text | NOT NULL, `new` |
| `created_at` | timestamptz | NOT NULL, `now()` |

The current backend writes these fields and rejects enquiry category/product/
collection metadata because there are no corresponding columns in the
inspected schema. Status-value checks, indexes, and RLS are **NOT VERIFIED**.

## 2. Primary keys and relationships

Live OpenAPI metadata identifies primary keys on all eight tables. It
identifies these foreign keys:

- `products.collection_id` → `collections.id`
- `product_images.product_id` → `products.id`
- `product_variants.product_id` → `products.id`
- `order_items.order_id` → `orders.id`
- `order_items.product_id` → `products.id`
- `order_items.variant_id` → `product_variants.id`

Read-only PostgREST embedding probes succeeded for those product and order
relationships. The `admin_users.user_id` → `auth.users.id` relationship and
all FK delete/update actions remain **NOT VERIFIED**.

Primary keys establish uniqueness for each row ID. Other unique constraints
(such as collection/product slugs or variant SKU), indexes, and check
constraints are **NOT VERIFIED**; they are not exposed in the available
OpenAPI metadata.

## 3. Backend comparison

The backend's live-schema mappings align with the exposed columns:

- [productController.js](./backend/src/controllers/productController.js) reads
  `image_url`, `cloudinary_public_id`, `sort_order`, `size`, `color`, `price`,
  `stock`, and activation fields.
- [collectionController.js](./backend/src/controllers/collectionController.js)
  reads the exposed collection and product fields.
- [orderController.js](./backend/src/controllers/orderController.js) passes
  customer fields and variant IDs/quantities to `create_order`, then reads
  order/item snapshot fields. It expects `create_order` to return a UUID.
- [enquiryController.js](./backend/src/controllers/enquiryController.js)
  inserts `customer_name`, `customer_phone`, optional email, message, and
  status `new`.
- [adminController.js](./backend/src/controllers/adminController.js) reads
  the five order fields and the ten item fields listed above.

The backend README's expected-table list omits `admin_users`, although the
admin authorization workflow depends on `is_admin()` and that table.

## 4. Product and variant requirements

- Product-to-collection, product-to-images, and product-to-variants relations
  are represented in the live API metadata and embeddings succeeded.
- The backend groups images and variants as arrays. Whether a unique constraint
  accidentally limits either child table to one row per product is
  **NOT VERIFIED**.
- `size` and `color` are nullable, as required.
- `price` is numeric; `stock` is integer with default `0`.
- Product and variant activation booleans are present with default `true`.
- `image_url`, `cloudinary_public_id`, and `sort_order` are present with the
  expected types.
- No nonnegative price/stock checks or SKU uniqueness can be confirmed.

## 5. Orders, items, and stock workflow

- `orders.id` is a UUID primary key with a generated UUID default.
- An order has an `order_items` relationship; each order can be represented
  with multiple item rows.
- Product name and price snapshot columns exist: `product_name`,
  `product_price`, and `line_total`.
- Selected size and colour are nullable.
- Backend request validation requires 1–50 distinct variant IDs and an
  integer quantity from 1 through 1000. This does not substitute for RPC or
  database-side validation; those rules are **NOT VERIFIED**.
- `total_amount` is numeric and required. The function's calculation and
  rounding behavior are **NOT VERIFIED**.
- `stock_deducted` is a required boolean defaulting to `false`.

The live RPC metadata exposes:

- `create_order(p_customer_name text, p_customer_phone text, p_items jsonb)`
- `confirm_order(p_order_id uuid)`
- `is_admin()` with no arguments

The RPC response schemas are not provided by the metadata. The backend expects
`create_order` to return a UUID and `is_admin()` to return boolean `true`.
Those return types, function bodies, transaction behavior, function grants,
and stock-deduction/idempotency logic are **NOT VERIFIED** by this audit.
The functions were not invoked. The project owner reports a `create_order`
defect in which the product ID is assigned to the variant-ID variable during
the second loop. That report has not been independently checked because the
live function body is not accessible; it is not safe to replace the entire
function without inspecting its complete definition and permissions.

## 6. RLS and security

- The project owner reports RLS is enabled on all eight tables. That state
  could not be independently verified. Policy definitions, commands,
  predicates, and roles are **NOT VERIFIED**; OpenAPI metadata does not expose
  them, and there are no pre-existing SQL definitions in the workspace.
- Anonymous `limit=0` GET probes returned HTTP 200 for all eight tables, but
  returned no rows. This cannot distinguish RLS-off access from RLS policies
  that return no rows, so it is not evidence that the tables are safe or
  unsafe for public reads.
- Backend confirmation requires a verified Bearer token and calls
  `confirm_order` with a user-scoped client/JWT. Admin session and order-list
  endpoints also verify the user and call `is_admin()`.
- The order-list endpoint performs its table reads with the server-side client
  only after the JWT-bound admin check. The service key is not sent to frontend
  code.
- The current backend has no catalog-write or enquiry-management admin routes.
  Its admin routes are session verification and order listing; storefront
  collection/product endpoints are read-only and filter inactive data.
- The storefront checkout currently saves a browser-local demo order and
  opens WhatsApp. It does not call `POST /api/orders`, so the live order RPC is
  not exercised by that checkout.
- A frontend source scan found no service-role/secret-key patterns. The
  publishable key is expected to be public.
- The `is_admin()` implementation's use of `auth.uid()`, its table lookup, and
  execute permissions were not visible in the live API metadata. The
  `admin_users` table has a `user_id` primary key, but its FK to `auth.users`
  is unverified.

## 7. Nine-column Orders display — **PASS**

The owner confirmed one row per order and these nine columns, in order:

1. Order ID
2. Customer Name
3. Customer Phone
4. Product Summary
5. Total Items
6. Total Amount
7. Stock Deducted
8. Order Details
9. Action

The Orders section now renders these columns as a table. Product Summary,
Total Items, and Order Details are derived from related `order_items`; Total
Amount comes from `orders.total_amount`; Stock Deducted uses the actual
`orders.stock_deducted` field. The Action column uses the protected existing
confirmation endpoint for database orders. Browser-only demo orders remain
editable, display `N/A` for database stock deduction, and cannot confirm stock.

No `created_at` or textual order `status` field was invented. The table
preserves the existing dashboard navigation, login, and other sections.

## 8. Missing evidence and risks

1. No pre-existing executable schema/function/policy SQL scripts or migrations
   are present in the workspace.
2. Need a read-only catalog export/query for constraints, indexes, RLS flags,
   policies, FK actions, and function definitions/ACLs.
3. Need to verify the `admin_users.user_id` relationship to `auth.users`.
4. Need to verify whether nullable `order_items.product_id` and `variant_id`
   are supported by the FK actions and live RPCs for historical snapshots.
5. Need the full live definitions, owners, search paths, return types, and
   grants for `create_order`, `confirm_order`, and `is_admin`.
6. Need to verify the reported product/variant-ID assignment bug and all
   order/stock business rules against those function bodies.
7. Need to verify constraints for nonnegative price/stock, positive quantity,
   snapshot arithmetic, unique slugs/SKUs, and multiple images/variants.

No database writes, function invocations, or schema changes were performed.

## 9. Recommended schema and migration decision

Based on the live columns that were verifiable, retain the eight existing
tables and their current names. Keep variant `size` and `color` nullable, and
keep the existing image and order snapshot fields. Derive the confirmed
nine-column display from existing order and item data; do not add Orders
columns, status, or timestamps.

Before approving any DDL, verify the missing catalog details and function
definitions. In particular, do not change nullable item references, unique
constraints, indexes, or RLS policies based only on this API metadata.

**No executable migration is proposed:** no missing column or constraint was
proven from the available metadata, and the unresolved items require catalog
evidence or business confirmation. The companion review file is comments
only; it is not a migration to apply.

## 10. Phase 1 completion status

| Area | Status |
|---|---|
| Eight table names and exposed columns/types/defaults | **PASS** |
| Primary keys and exposed public-schema foreign keys | **PASS** |
| Optional variant size and colour | **PASS** |
| Snapshot columns and order-item relationship | **PASS** |
| Unique/check constraints and indexes | **NOT VERIFIED** |
| `admin_users` FK to `auth.users` | **NOT VERIFIED** |
| RLS state and policies | **NOT VERIFIED** |
| RPC bodies, return types, permissions, and stock safety | **NOT VERIFIED; reported `create_order` bug pending source** |
| Backend request cap (50 distinct variants, quantity 1–1000) | **PASS — API validation only; DB function checks unverified** |
| Nine-column Orders display and one-row-per-order UI | **PASS** |
| Proposed executable migration | **None justified yet** |

**Phase 1 is not complete** until the unverified database catalog items and
function behavior are checked, required schema constraints are confirmed, and
any genuinely required migration has been reviewed and approved.
