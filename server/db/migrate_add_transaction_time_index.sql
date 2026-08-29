-- One-time migration: add an index on transactions.transaction_time to an
-- existing DB.
--
-- Purely additive — no rows are touched, no existing query behavior changes.
--
-- Run this ONCE against an existing pos_db that predates this index.
-- A fresh install doesn't need this — schema.sql already creates this
-- index directly.
--
-- Not idempotent — running it twice will fail (index already exists),
-- which is the intended safety net against a double-run.

USE pos_db;

ALTER TABLE transactions
  ADD KEY idx_transactions_transaction_time (transaction_time);
