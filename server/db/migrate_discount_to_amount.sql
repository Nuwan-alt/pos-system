-- One-time migration: percentage-based product discounts → fixed rupee amounts.
--
-- Run this ONCE against an existing pos_db that still has the old
-- `discount` (percentage) column. A fresh install doesn't need this —
-- schema.sql already creates `discount_amount` directly.
--
-- What it does:
--   1. Adds discount_amount, matching price's DECIMAL(10,2) precision.
--   2. Converts each row's percentage into the equivalent rupee amount,
--      based on that row's own price, so nothing changes visually.
--   3. Drops the old discount column.
--
-- Not idempotent — running it twice will fail at step 1 (column already
-- exists), which is the intended safety net against a double-run.

USE pos_db;

ALTER TABLE products
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER discount;

UPDATE products
  SET discount_amount = ROUND(price * discount / 100, 2);

ALTER TABLE products
  DROP COLUMN discount;
