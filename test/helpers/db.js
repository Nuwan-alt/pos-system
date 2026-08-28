const mysql = require('mysql2/promise')
const { encodePassword } = require('../../server/utils/passwordEncoding')

let pool

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      timezone: '+05:30',
    })
  }
  return pool
}

const TABLES = [
  'transaction_items',
  'deletion_requests',
  'transactions',
  'stock_updates',
  'cash_drawer',
  'products',
  'cashiers',
  'settings',
]

// Fixed baseline used by every test: 1 active + 1 disabled cashier,
// 2 products with known stock levels. Explicit IDs rely on TRUNCATE
// resetting AUTO_INCREMENT, so every test starts from the same state.
async function resetDb() {
  const db = getPool()
  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const table of TABLES) {
    await db.query(`TRUNCATE TABLE ${table}`)
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1')

  await db.query(
    'INSERT INTO settings (`key`, value) VALUES (?, ?), (?, ?)',
    ['admin_password', encodePassword('admin123'), 'cashier_password', encodePassword('cashier123')]
  )
  await db.query(
    `INSERT INTO cashiers (id, name, nic, mobile, status) VALUES
      (1, 'Active Cashier',   '200012345678', '0771234567', 'active'),
      (2, 'Disabled Cashier', '199556789012', '0712345678', 'disabled')`
  )
  await db.query(
    `INSERT INTO products (id, name, price, discount_amount, stock, min_threshold) VALUES
      (1, 'Test Product A', 100.00,  0.00, 50, 10),
      (2, 'Test Product B', 200.00, 20.00,  5, 10)`
  )
}

async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

module.exports = { getPool, resetDb, closePool }
