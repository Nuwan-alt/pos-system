CREATE DATABASE IF NOT EXISTS pos_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_db;

-- ─────────────────────────────────────────────────────────────
-- 1. settings
-- ─────────────────────────────────────────────────────────────
-- value stores admin_password/cashier_password base64-encoded (not hashed —
-- accepted tradeoff for this offline single-machine context), see
-- server/utils/passwordEncoding.js
CREATE TABLE IF NOT EXISTS settings (
  id    INT          NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(50)  NOT NULL UNIQUE,
  value VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);

-- ─────────────────────────────────────────────────────────────
-- 2. cashiers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashiers (
  id         INT                       NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100)              NOT NULL,
  nic        VARCHAR(12)               DEFAULT NULL,
  mobile     VARCHAR(15)               DEFAULT NULL,
  status     ENUM('active','disabled') NOT NULL DEFAULT 'disabled',
  created_at DATETIME                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. products
--    Soft-deleted via is_deleted flag; records are never removed
--    so product_id FKs in transaction_items always stay valid.
--
--    Images: thumbnail_blob (~200x200, <30KB, JPEG) and full_blob
--    (~800x800 max, JPEG) are both generated server-side from a
--    single upload — see server/utils/imageProcessing.js. has_image
--    exists so list/table/search queries never have to name the
--    blob columns just to check presence — SELECT ... FROM products
--    must NEVER select thumbnail_blob/full_blob except in the two
--    routes whose entire job is serving image bytes.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              INT           NOT NULL AUTO_INCREMENT,
  name            VARCHAR(255)  NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock           INT           NOT NULL DEFAULT 0,
  min_threshold   INT           NOT NULL DEFAULT 0,
  thumbnail_blob  MEDIUMBLOB    NULL,
  full_blob       MEDIUMBLOB    NULL,
  image_mime      VARCHAR(50)   NULL,
  has_image       TINYINT(1)    NOT NULL DEFAULT 0,
  -- Drives the image URLs' cache-busting ?v= param and their ETag.
  -- Deliberately a counter, not updated_at: a wall-clock timestamp can
  -- collide when two writes land in the same tick (plain DATETIME is only
  -- 1-second precision, and even millisecond precision isn't a hard
  -- guarantee under fast local writes) — an incrementing counter can't.
  -- It also only changes when the image itself changes, not on every
  -- unrelated text-field edit.
  image_version   INT           NOT NULL DEFAULT 0,
  is_deleted      TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ─────────────────────────────────────────────────────────────
-- 4. transactions
--    cashier_id is nullable so that deleting a cashier does not
--    destroy historical transaction records (ON DELETE SET NULL).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               INT           NOT NULL AUTO_INCREMENT,
  transaction_ref  VARCHAR(30)   NOT NULL UNIQUE,
  cashier_id       INT           NULL,
  total            DECIMAL(10,2) NOT NULL,
  is_deleted       TINYINT(1)    NOT NULL DEFAULT 0,
  transaction_time DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_transactions_cashier
    FOREIGN KEY (cashier_id)
    REFERENCES cashiers(id)
    ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- 5. transaction_items
--    product_id is NOT NULL because products are soft-deleted and
--    never physically removed — the FK always resolves.
--    product_name and unit_price are snapshot values captured at
--    the time of sale, preserved regardless of later price edits.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
  id             INT           NOT NULL AUTO_INCREMENT,
  transaction_id INT           NOT NULL,
  product_id     INT           NOT NULL,
  product_name   VARCHAR(255)  NOT NULL,
  qty            INT           NOT NULL,
  unit_price     DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_items_transaction
    FOREIGN KEY (transaction_id)
    REFERENCES transactions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
);

-- ─────────────────────────────────────────────────────────────
-- 6. deletion_requests
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id             INT                                  NOT NULL AUTO_INCREMENT,
  transaction_id INT                                  NOT NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at   DATETIME                             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at    DATETIME                             NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_deletion_transaction
    FOREIGN KEY (transaction_id)
    REFERENCES transactions(id)
    ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- 7. stock_updates
--    Audit log for every stock change (admin "adjust" or cashier
--    "update"). quantity_added is a signed delta.
--
--    This table (and cash_drawer below) predate schema.sql — they were
--    created ad hoc before either table existed here (see git history /
--    CLAUDE.md's old "Known gap" note), so their exact shape was reverse
--    -engineered from `SHOW CREATE TABLE` against the live DB rather than
--    designed fresh: nullable updated_at, and utf8mb4_general_ci instead
--    of this file's usual utf8mb4_unicode_ci. Matched here on purpose —
--    a fresh install (Docker, a new machine) should behave identically
--    to the table actually running in production, not a "cleaner"
--    version of it.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_updates (
  id               INT                     NOT NULL AUTO_INCREMENT,
  product_id       INT                     NOT NULL,
  updated_by_id    INT                     NOT NULL,
  updated_by_role  ENUM('cashier','admin') NOT NULL,
  quantity_added   INT                     NOT NULL,
  note             VARCHAR(255)            DEFAULT NULL,
  updated_at       DATETIME                DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_stock_updates_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────
-- 8. cash_drawer
--    One record per calendar day (drawer_date UNIQUE). Same
--    reverse-engineered-from-live note as stock_updates above.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_drawer (
  id               INT                     NOT NULL AUTO_INCREMENT,
  drawer_date      DATE                    NOT NULL UNIQUE,
  opening_amount   DECIMAL(10,2)           NOT NULL,
  opening_time     DATETIME                NOT NULL,
  opening_note     VARCHAR(255)            DEFAULT NULL,
  opened_by_role   ENUM('admin','cashier') NOT NULL,
  opened_by_id     INT                     NOT NULL,
  opened_by_name   VARCHAR(100)            NOT NULL,
  closing_amount   DECIMAL(10,2)           DEFAULT NULL,
  closing_time     DATETIME                DEFAULT NULL,
  closing_note     VARCHAR(255)            DEFAULT NULL,
  closed_by_role   ENUM('admin','cashier') DEFAULT NULL,
  closed_by_id     INT                     DEFAULT NULL,
  closed_by_name   VARCHAR(100)            DEFAULT NULL,
  status           ENUM('open','closed')   DEFAULT 'open',
  created_at       DATETIME                DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────

-- base64 of 'admin123' and 'cash123' respectively
INSERT INTO settings (`key`, value) VALUES
  ('admin_password',   'YWRtaW4xMjM='),
  ('cashier_password', 'Y2FzaDEyMw==');

