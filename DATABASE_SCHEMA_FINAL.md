# Shrithi Couture — Phase 1 Schema Reconciliation

**Status: BLOCKED / NOT COMPLETE.** The exposed schema metadata and the
confirmed Orders display are documented. The database catalog needed to verify
constraints, indexes, RLS policies, FK actions, and RPC implementations is not
available in this environment. No live schema change or database write was
performed.

## Evidence gathered

- Read-only Supabase PostgREST metadata was used to verify exposed columns,
  types, nullability/default metadata, primary keys, public-schema foreign-key
  relationships, and the available RPC names/arguments.
- Read-only exact-count requests returned one `admin_users` row and zero rows
  in the other seven tables. No row values were retrieved.
- Read-only checks found zero visible records violating the tested price,
  stock, quantity, snapshot-price, historical-reference, or total-amount
  filters. The product and order tables are empty, so this is not evidence that
  database constraints exist.
- `backend/.env` has Supabase API configuration but no database connection
  string or Management API access token. `psql` and the Supabase CLI are
  unavailable. No credential values were printed.
- The project owner reports that RLS is enabled on all eight tables and that
  the live `create_order` function assigns a product ID to its variant-ID
  variable in the item-insert loop. These reports are recorded as owner
  statements, not independent database verification.
- The companion `database/migrations/phase_1_schema_review.sql` contains only
  commented, read-only verification queries; it contains no executable DDL.

## Table inventory

Types, nullability, and defaults below reflect the live API metadata. PK and
public FK information is limited to what that metadata exposed.

| Table | Verified columns and types | PK / relationship |
|---|---|---|
| `collections` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `name` text NOT NULL; `slug` text NOT NULL; `description` text NULL; `cover_image_url` text NULL; `is_active` boolean NOT NULL DEFAULT `true`; `sort_order` integer NOT NULL DEFAULT `0`; `created_at`, `updated_at` timestamptz NOT NULL DEFAULT `now()` | PK `id` |
| `products` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `collection_id` uuid NOT NULL; `name`, `slug` text NOT NULL; `description` text NULL; `is_active` boolean NOT NULL DEFAULT `true`; `is_featured` boolean NOT NULL DEFAULT `false`; `sort_order` integer NOT NULL DEFAULT `0`; `created_at`, `updated_at` timestamptz NOT NULL DEFAULT `now()` | PK `id`; FK `collection_id` → `collections.id` |
| `product_images` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `product_id` uuid NOT NULL; `image_url` text NOT NULL; `cloudinary_public_id`, `alt_text` text NULL; `sort_order` integer NOT NULL DEFAULT `0`; `created_at` timestamptz NOT NULL DEFAULT `now()` | PK `id`; FK `product_id` → `products.id` |
| `product_variants` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `product_id` uuid NOT NULL; `sku` text NOT NULL; `size`, `color` text NULL; `price` numeric NOT NULL; `stock` integer NOT NULL DEFAULT `0`; `is_active` boolean NOT NULL DEFAULT `true`; `created_at`, `updated_at` timestamptz NOT NULL DEFAULT `now()` | PK `id`; FK `product_id` → `products.id` |
| `admin_users` | `user_id` uuid NOT NULL; `created_at` timestamptz NOT NULL DEFAULT `now()` | PK `user_id`; FK to `auth.users.id` NOT VERIFIED |
| `orders` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `customer_name`, `customer_phone` text NOT NULL; `total_amount` numeric NOT NULL; `stock_deducted` boolean NOT NULL DEFAULT `false` | PK `id` |
| `order_items` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `order_id` uuid NOT NULL; `product_id`, `variant_id` uuid NULL; `product_name` text NOT NULL; `selected_size`, `selected_color` text NULL; `quantity` integer NOT NULL; `product_price`, `line_total` numeric NOT NULL | PK `id`; FKs `order_id` → `orders.id`, `product_id` → `products.id`, `variant_id` → `product_variants.id` |
| `enquiries` | `id` uuid NOT NULL DEFAULT `gen_random_uuid()`; `customer_name`, `customer_phone`, `message`, `status` text NOT NULL; `customer_email` text NULL; `created_at` timestamptz NOT NULL DEFAULT `now()`; `status` default `new` | PK `id` |

Primary keys and the listed public foreign-key targets are exposed by live
metadata. Foreign-key `ON DELETE`/`ON UPDATE` behavior, unique/check
constraints, indexes, and RLS are not exposed by that metadata.

## Requirements reconciliation

### Products, images, and variants

- The schema has `products.collection_id`, one-to-many image/variant
  relationships, and the required image fields `image_url`,
  `cloudinary_public_id`, and `sort_order`.
- Variant `size` and `color` are nullable, so products without either
  attribute are structurally supported.
- Variant `price` is numeric, `stock` is integer, and product/variant active
  flags exist.
- Whether price is constrained positive, stock nonnegative, SKU unique, and
  child rows truly permit multiple images/variants is **NOT VERIFIED**.
- There are currently no collections, products, images, or variants in the
  inspected project. No sample catalogue data is available for order testing.

### Orders, snapshots, and stock

- An order can relate to multiple `order_items`; item snapshots are represented
  by required `product_name`, `product_price`, and `line_total`. Selected
  size/colour and product/variant references are nullable.
- The existing nullable references can support historical snapshots only if
  FK deletion behavior and the RPC workflow preserve them. Those details are
  **NOT VERIFIED**; do not alter FKs before inspecting them.
- `create_order(p_customer_name text, p_customer_phone text, p_items jsonb)`,
  `confirm_order(p_order_id uuid)`, and `is_admin()` are exposed by RPC
  metadata. Return types, bodies, transaction behavior, price/stock validation,
  stock-deduction timing, duplicate-deduction protection, security-definer
  settings, and execute permissions remain **NOT VERIFIED**.
- The reported product/variant-ID assignment bug cannot be confirmed or safely
  repaired without the complete function definition. Replacing the complete
  function from assumptions could remove existing validation, grants, or
  security settings.
- The backend validates 1–50 distinct variant IDs and per-item integer
  quantities from 1 through 1000. It returns the existing `line_total` field
  when reading created order details. These backend checks do not substitute
  for RPC or database-side validation.
- The live project currently has no orders or order items. No live order or
  confirmation RPC was called.

### Security and relationships

- The owner reports RLS is enabled on all eight tables; this was not
  independently verified. Policy commands, predicates, roles, and outcomes
  remain **NOT VERIFIED**.
- The `admin_users.user_id` → `auth.users.id` FK is **NOT VERIFIED**.
- The backend's existing protected confirmation flow forwards the verified
  administrator JWT; the admin Orders list checks admin status before its
  server-side reads. No SQL function behavior is inferred from this backend
  code.
- The backend exposes no catalog-write or enquiry-management admin APIs.
  Storefront catalog APIs are read-only and filter inactive rows. The
  storefront checkout still writes a local demo order and opens WhatsApp; it
  does not call `POST /api/orders`.
- The service-role key remains server-side; it was not copied into frontend
  files or printed.

### Orders dashboard

The confirmed one-row-per-order display is implemented using exactly these
nine columns, in order:

1. Order ID
2. Customer Name
3. Customer Phone
4. Product Summary
5. Total Items
6. Total Amount
7. Stock Deducted
8. Order Details
9. Action

Product Summary and Total Items derive from order items. Total Amount and Stock
Deducted use the existing order fields. Database confirmation remains behind
the protected endpoint. Local demo orders stay browser-only and show `N/A` for
stock deduction; they cannot invoke database confirmation. No `status` or
timestamp column was added.

## Constraints, migrations, and safe next steps

No missing column or absent constraint has been proven. Therefore **no
executable migration is proposed**. Creating a constraint before inspecting
existing definitions could duplicate it; changing nullable references or FK
actions without inspecting dependencies could break history. The SQL review
file is a no-op containing only commented, read-only queries.

The project owner's reported `create_order` bug requires a separate corrected
function definition. That replacement is **not prepared** because the complete
live function body, owner, security settings, and grants are unavailable.
`database/migrations/phase_1_create_order_fix.sql` is a comments-only request
for the read-only source and permission inspection needed before writing a
safe replacement.

Safest completion order:

1. Provide access to a read-only PostgreSQL catalog session (connection role
   with catalog visibility), or run the commented SELECT queries in the
   Supabase SQL Editor and share sanitized results. Do not send passwords or
   access tokens in chat.
2. Verify all constraints, indexes, RLS policies, FK actions, `auth.users`
   relationship, and the complete definitions/ACLs of the three RPC functions.
3. Check all existing data and function dependencies against the requested
   checks before proposing DDL. Keep nullable historical references unless
   verified evidence establishes a safe alternative.
4. Propose only missing, non-duplicative constraints or indexes. Review the
   exact migration and test it against a backup/staging database first.
5. Apply an approved migration manually with a backup and post-migration
   verification. This audit did not execute a migration.
6. Seed valid collection/product/variant data in a non-production test project
   before performing any order integration tests. Do not create test orders
   or confirm orders against production.

## Final status

| Area | Status |
|---|---|
| Eight table names, exposed columns/types/defaults, primary keys | **PASS — API metadata verified** |
| Public-schema foreign-key targets | **PASS — targets verified; delete/update actions NOT VERIFIED** |
| Nullable variant size/colour and required image/order snapshot fields | **PASS — columns verified** |
| Nine-column, one-row-per-order display | **PASS — implemented** |
| API quantity range 1–1000 | **PASS — backend validation implemented** |
| API item count 1–50 and duplicate variant rejection | **PASS — backend validation implemented** |
| Constraints, indexes, existing-data dependencies for DDL | **NOT VERIFIED** |
| `admin_users` → `auth.users` relationship | **NOT VERIFIED** |
| RLS enablement (owner-reported) and policy behavior | **NOT VERIFIED** |
| Function definitions, ownership, search paths, and permissions | **NOT VERIFIED** |
| `create_order` reported ID bug and other business logic | **PENDING live source** |
| `confirm_order` concurrency/idempotency and stock safety | **NOT VERIFIED** |
| Migration execution | **NOT PERFORMED** |

**Phase 1 remains blocked** until catalog access or sanitized read-only SQL
results are available and all security/function behavior is verified.
