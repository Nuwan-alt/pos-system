-- One-time migration: add barcode support to an existing DB.
--
-- Purely additive — the new column is nullable, and no existing row is
-- touched. Products with no barcode keep working exactly as they do today.
--
-- Run this ONCE against an existing pos_db that predates barcode support.
-- A fresh install doesn't need this — schema.sql already creates this
-- column (and its unique index) directly.
--
-- Not idempotent — running it twice will fail at the ADD COLUMN step
-- (column already exists), which is the intended safety net against a
-- double-run.

USE pos_db;

ALTER TABLE products
  ADD COLUMN barcode VARCHAR(32) NULL AFTER min_threshold,
  ADD UNIQUE KEY uq_products_barcode (barcode);
