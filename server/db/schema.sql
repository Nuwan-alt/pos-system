CREATE DATABASE IF NOT EXISTS pos_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_db;

-- ─────────────────────────────────────────────────────────────
-- 1. settings
-- ─────────────────────────────────────────────────────────────
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
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(255)  NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  discount      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  stock         INT           NOT NULL DEFAULT 0,
  min_threshold INT           NOT NULL DEFAULT 0,
  is_deleted    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
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
-- SEED DATA
-- ─────────────────────────────────────────────────────────────

INSERT INTO settings (`key`, value) VALUES
  ('admin_password',   'admin123'),
  ('cashier_password', 'cashier123');

INSERT INTO cashiers (name, nic, mobile, status, created_at) VALUES
  ('John Doe',     '200012345678', '0771234567', 'active',   '2026-05-15 00:00:00'),
  ('Jane Smith',   '199556789012', '0712345678', 'active',   '2026-05-20 00:00:00'),
  ('Mike Johnson', '981234567V',   '0751234567', 'disabled', '2026-05-25 00:00:00');

INSERT INTO products (name, price, discount, stock, min_threshold) VALUES
  ('Milk 1L',              120.00,  0.00, 150, 30),
  ('Bread Loaf',            95.00,  0.00,  80, 20),
  ('Eggs (12 Pack)',        420.00,  0.00,  60, 15),
  ('Butter 200g',          250.00,  5.00,  45, 10),
  ('Yoghurt 100g',          45.00, 10.00, 200, 50),
  ('Curd 400g',            185.00,  0.00,  55, 15),
  ('Orange Juice 1L',      350.00,  0.00,  40, 10),
  ('Cool Drink 330ml',      80.00,  0.00, 120, 30),
  ('Rice 1kg',             220.00,  0.00, 100, 25),
  ('Sugar 1kg',            185.00,  0.00,  90, 20),
  ('Cheese Slice 200g',    180.00,  0.00,  35, 10),
  ('Dark Chocolate 100g',  225.00, 15.00,  50, 15),
  ('Biscuits 200g',         75.00,  5.00,  18, 20),
  ('Instant Noodles',       55.00,  0.00,  85, 25),
  ('Coconut Oil 500ml',    320.00,  0.00,  30, 10);
