-- One-time migration: add product image storage to an existing DB.
--
-- Purely additive — every new column is nullable (or defaults to 0), and no
-- existing row is touched. Products with no image keep working exactly as
-- they do today; has_image and image_version both default to 0 for all of
-- them.
--
-- Run this ONCE against an existing pos_db that predates image support.
-- A fresh install doesn't need this — schema.sql already creates these
-- columns directly.
--
-- Not idempotent — running it twice will fail at the ADD COLUMN step
-- (columns already exist), which is the intended safety net against a
-- double-run.

USE pos_db;

ALTER TABLE products
  ADD COLUMN thumbnail_blob MEDIUMBLOB NULL             AFTER min_threshold,
  ADD COLUMN full_blob      MEDIUMBLOB NULL             AFTER thumbnail_blob,
  ADD COLUMN image_mime     VARCHAR(50) NULL            AFTER full_blob,
  ADD COLUMN has_image      TINYINT(1) NOT NULL DEFAULT 0 AFTER image_mime,
  ADD COLUMN image_version  INT NOT NULL DEFAULT 0        AFTER has_image;
