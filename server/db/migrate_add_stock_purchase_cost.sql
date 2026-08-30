-- One-time migration: add purchase cost tracking to an existing DB.
--
-- Purely additive — both new columns are nullable, and no existing row is
-- touched or backfilled. Stock updates recorded before this feature simply
-- have no cost data, same as they do today.
--
-- Run this ONCE against an existing pos_db that predates purchase cost
-- tracking. A fresh install doesn't need this — schema.sql already creates
-- these columns directly.
--
-- Not idempotent — running it twice will fail at the ADD COLUMN step
-- (column already exists), which is the intended safety net against a
-- double-run.

USE pos_db;

ALTER TABLE stock_updates
  ADD COLUMN buying_price_per_unit DECIMAL(10,2) NULL AFTER quantity_added,
  ADD COLUMN total_cost DECIMAL(10,2) NULL AFTER buying_price_per_unit;
