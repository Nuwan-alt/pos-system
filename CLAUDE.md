# POS System

Offline Point-of-Sale system for a local store. All data lives in local MySQL — no cloud dependency, single-machine deployment.

## Stack

- **Frontend:** React 18 + React Router v7, Tailwind CSS v4 (CSS-based config via `@tailwindcss/vite`), Lucide React icons, Vite 6 (dev server on port 5173)
- **Backend:** Node.js + Express (CommonJS), mysql2/promise (port 5001), `multer` (multipart upload parsing, memory storage) + `sharp` (image resize/compress/EXIF-strip)
- **Database:** MySQL via XAMPP, local only. `max_allowed_packet` on the XAMPP install is the MySQL default, **1MB** — product image compression targets are sized to stay comfortably under that, but if uploads ever need to be larger/higher-quality, bump it in `C:\xampp\mysql\bin\my.ini` (`[mysqld]` → `max_allowed_packet=64M`) and restart MySQL
- Client proxies `/api/*` to the server via `vite.config.js`

## Structure

- `client/src/pages/` — `admin/`, `cashier/`, `shared/` (role-scoped route components)
- `client/src/components/` — reusable UI (e.g. `DatePickerCalendar`, `TransactionCompleteModal`)
- `client/src/context/` — `POSContext` (products/cashiers, fetched once at app load), `AuthContext` (login/logout, role)
- `client/src/lib/api.js` — `apiFetch()` helper, base URL from `VITE_API_URL` or `localhost:5001`
- `server/routes/` — one file per resource (auth, cashiers, products, transactions, deletionRequests, dashboard, reports, settings, stock, drawer)
- `server/middleware/verifyAdminPassword.js` — validates `adminPassword` in request body against `settings` table. Used only for the two actions judged genuinely harder to undo: deleting a cashier account (destroys a login credential) and editing a closed drawer's amounts (rewrites the finalized cash record)
- `server/middleware/verifyConfirmCode.js` — validates a fixed `confirmCode` ("123") in the request body; not authentication, a deliberate low-friction confirmation gate for routine, easily-undone admin actions where re-entering the real admin password (already used once at login) was judged unnecessary friction — same offline-single-machine tradeoff spirit as `passwordEncoding.js`. Used by `PATCH /api/cashiers/:id/status` (enable/disable), `PATCH /api/deletion-requests/:id/approve|reject`, `DELETE /api/products/:id`, and `POST /api/drawer/reset`
- `server/utils/pricing.js` — `validateDiscountAmount(price, discountAmount)`, shared by POST/PUT `/api/products`
- `client/src/utils/pricing.js` — `getEffectivePrice(price, discountAmount)`, the single source of truth for "price minus discount," used by both the admin form/table and the cashier cart/cards
- `server/utils/imageProcessing.js` — `processProductImage(buffer)` (sharp: content-validates JPEG/PNG/WebP, strips EXIF, produces a ~200×200 <30KB JPEG thumbnail + an ~800×800-max JPEG full image) and `assertWithinMaxPacket(db, bytes)` (checks the pending write against MySQL's `max_allowed_packet` before it happens)
- `server/utils/passwordEncoding.js` — `encodePassword(plain)`, base64-encodes a password; used by every route/middleware that reads or writes `admin_password`/`cashier_password` so the `settings` table never holds plain text. `decodePassword(encoded)` reverses it, used only by `GET /api/settings/password/cashier` (admin-facing cashier-password reveal)
- `server/middleware/upload.js` — `uploadSingleImage(field)`, a `multer` memory-storage wrapper (5MB limit) that turns Multer's errors into this app's `{ error }` JSON shape
- `server/db/schema.sql` + `connection.js`
- `server/db/migrate_discount_to_amount.sql` — one-time, non-idempotent script to migrate an existing DB (e.g. XAMPP) from the old percentage `discount` column to `discount_amount`; not needed for a fresh install, `schema.sql` already creates the new column directly
- `server/db/migrate_add_product_images.sql` — one-time, non-idempotent, purely additive script adding the image columns (see Product images below) to an existing DB; not needed for a fresh install
- `server/db/migrate_password_base64.sql` — one-time, non-idempotent script to base64-encode the plain-text passwords already stored in an existing DB's `settings` table; not needed for a fresh install, `schema.sql` already seeds the encoded values
- `server/db/migrate_add_transaction_time_index.sql` — one-time, non-idempotent, purely additive script adding an index on `transactions.transaction_time` to an existing DB; not needed for a fresh install, `schema.sql` already creates it directly. Added to keep date-range reporting queries viable as transaction volume grows (~500/day) over months of history — note the existing report queries (`server/routes/reports.js`, `dashboard.js`) filter with `DATE(t.transaction_time) = ...` / `YEAR(t.transaction_time) = ...`, which aren't sargable, so this index doesn't yet speed those specific queries up until they're rewritten as range comparisons
- `server/db/migrate_add_stock_purchase_cost.sql` — one-time, non-idempotent, purely additive script adding `buying_price_per_unit`/`total_cost` to `stock_updates` on an existing DB; not needed for a fresh install, `schema.sql` already creates them directly. Both are nullable and never backfilled — historical rows predating this feature simply have no cost data
- `server/app.js` — configured Express app (routes, CORS, static client serving), exported without `.listen()` so tests can import it; `server/index.js` just requires it and listens
- `test/` — Jest + Supertest integration tests, one file per route module, run against a disposable Dockerized MySQL (see Testing below)

## Docker

- `Dockerfile` — multi-stage: builds the client, copies its `dist/` into the server image, which serves both the API and the static UI on one port (5001)
- `docker-compose.yml` — `db` (MySQL 8, initialized from `server/db/schema.sql`, host port 3308) + `server` (port 5001); copy `.env.example` to `.env` and set `DB_PASSWORD` before `docker compose up`

## Testing

- `npm test` from the repo root runs the full Jest suite (`test/*.test.js`) against every route module
- Tests hit a real, disposable MySQL container (`docker-compose.test.yml`, port 3309, tmpfs storage) spun up/down automatically via Jest `globalSetup`/`globalTeardown` — never touches the dev DB or XAMPP
- `test/helpers/db.js` truncates all tables and reseeds a fixed fixture (2 products, 2 cashiers, default passwords) before every test
- Known open issue (see the `UNUSUAL:` test in `test/transactions.test.js`):
  - `POST /api/transactions` never checks available stock before selling — oversells silently floor stock at 0 instead of being rejected (unlike `/api/stock/adjust` and `/api/stock/update`, which do check). The cashier UI already blocks this in normal use (`CashierTerminal.jsx`'s `hasStockIssue` disables "Complete Transaction"), but that check runs against the client's cached `stock` snapshot, not a live server-side check — so it's still reachable via a direct API call or a race between two near-simultaneous submissions. Not yet fixed.
- Fixed (see tests tagged `FIXED:`):
  - `POST /api/transactions` now recomputes each item's `subtotal` (`qty * unitPrice`) and the overall `total` server-side instead of trusting the client — a mismatched or tampered client total is silently overridden, not stored
  - `POST/PUT /api/products` and `POST /api/drawer/open|close|:id` used to validate numeric input with `parseFloat(x) <= 0` / `< 0`, which is always `false` for `NaN` — a non-numeric `price`/`opening_amount`/`closing_amount` bypassed validation and crashed the request with a 500 (mysql2 inlined the resulting `NaN` as an unquoted token, and MySQL rejected it as an unknown column). Now validated with `Number.isFinite()` and rejected with a 400

## Auth

- Role-based: admin / cashier, password-only (base64-encoded, not hashed, in `settings` table — accepted tradeoff for this offline single-machine context; see `server/utils/passwordEncoding.js`)
- Session stored in `localStorage` as `pos_user`
- Cashier login is shared (one password for all cashiers); individual cashier identity is chosen from a dropdown at transaction time
- `ProtectedRoute` redirects unauthenticated or wrong-role access

## Core domain

- **Products** — soft-deleted via `is_deleted` flag, never hard-removed (keeps `transaction_items` FKs valid). Discounts are a fixed rupee amount (`discount_amount`/`discountAmount`), not a percentage — `0` means no discount; server rejects any amount `>=` the product's price so the effective price can never hit zero or go negative
- **Product images** — stored as MySQL blobs (`thumbnail_blob`/`full_blob`, both `MEDIUMBLOB`), not files on disk, so `mysqldump` backups stay atomic. Both are generated server-side from one upload via `server/utils/imageProcessing.js`. `has_image` and `image_version` (an incrementing counter, deliberately *not* `updated_at` — see the comment in `schema.sql`) let list/table queries build a client-usable `thumbnailUrl`/`fullUrl` without ever selecting the blob columns.
  - **Hard rule: `SELECT *` — or any explicit selection of `thumbnail_blob`/`full_blob` — must never appear outside `GET /api/products/:id/image/thumb` and `GET /api/products/:id/image/full` in `server/routes/products.js`.** Every other products query (list, create, update, delete) names its columns explicitly via the `LIST_COLUMNS` constant and excludes both blobs.
  - The cashier terminal (`CashierTerminal.jsx`) only ever requests `thumbnailUrl`, lazy-loaded via `IntersectionObserver` (150-product catalogue — native `loading="lazy"` alone wasn't judged a strong enough guarantee); it must never reference `fullUrl`, which exists only for the admin edit-form preview
- **Transactions** — atomic creation (insert + stock deduction in one DB transaction); soft-deleted on approved deletion
- **Deletion requests** — cashier requests deletion → admin approves (atomic soft-delete + restock) or rejects; cashier can revert their own pending request
- **Cash drawer** — one record per day (`drawer_date UNIQUE`); open/close/reset/edit; admin-only reset/edit; polls every 30s. Opening amount is entered manually (admin or cashier), but closing amount is never entered — `POST /api/drawer/close` computes it server-side as `opening_amount + that day's completed (non-deleted) transactions.total`, so closing is just a button press. `GET /api/drawer/today` also returns `todaySales` so the close form can preview the "Expected Closing" breakdown before the button is pressed. The admin-only edit route (`PUT /api/drawer/:id`) still allows manually overriding `closing_amount` after the fact, for correcting a genuine discrepancy — this is a deliberate escape hatch, not part of the normal close flow. A cashier closing the drawer must additionally re-enter the shared cashier login password (`cashierPassword` in the request body, checked the same way as `settings.cashier_password` at login) as a confirmation step; admin closing skips this entirely, same as admin bypasses `verifyAdminPassword` on its own actions
- **Stock updates** — audit-logged; admin uses "adjust", cashier uses "update"; both atomic, both signed quantity deltas. A top-up (positive delta) always requires `buying_price_per_unit` — in this shop's workflow, adding stock always means it was just bought — while `total_cost` (`qty * buying_price_per_unit`) is always recomputed server-side, never trusted from the client. A removal (negative delta) never carries cost data, since it's never a purchase. "Current cost" for a product is intentionally not a stored/synced column — it's computed on read as the most recent `stock_updates` row for that product with a non-null `buying_price_per_unit`, which can't drift out of sync the way a denormalized field could. Stock Update History (`/admin/stock-history` and `/cashier/stock-history`, same component, both roles read-only) shows both new columns with "—" for historical rows that predate this feature, plus a client-side toggle to isolate top-ups still missing cost data. `GET /api/products/costs` exposes this same current-cost figure per product for the Manage Inventory table — deliberately a separate endpoint from `GET /api/products`, so cost data is never part of the payload the cashier terminal fetches and holds in memory

## Notes for future work

- `POSProvider` wraps the whole app, but `CashierTerminal` still fetches its own data independently rather than consuming context
- Avoid `overflow:hidden` on cards in `CashierTerminal` — it collapses card height; use a margin-top bar instead
