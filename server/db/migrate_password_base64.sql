-- One-time migration: base64-encode the plain-text passwords already
-- sitting in an existing pos_db's settings table.
--
-- server/utils/passwordEncoding.js now encodes every password the app
-- reads or writes, so a DB still holding the old plain-text values (e.g.
-- 'admin123') would reject the real admin/cashier password after upgrade.
-- This script re-encodes whatever is currently stored, in place.
--
-- Run this ONCE against an existing pos_db that predates base64 password
-- storage. A fresh install doesn't need this — schema.sql already seeds
-- the encoded values directly.
--
-- Not idempotent — running it twice will re-encode an already-encoded
-- value, breaking login. Only run it if you have not already run it.

USE pos_db;

UPDATE settings
SET value = TO_BASE64(value)
WHERE `key` IN ('admin_password', 'cashier_password');
