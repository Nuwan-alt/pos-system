const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const verifyAdminPassword = require('../middleware/verifyAdminPassword')

function toClient(r) {
  return {
    id:           r.id,
    name:         r.name,
    price:        parseFloat(r.price),
    discount:     parseFloat(r.discount),
    stock:        r.stock,
    minThreshold: r.min_threshold,
  }
}

// GET /api/products — all non-deleted products
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, price, discount, stock, min_threshold FROM products WHERE is_deleted = 0 ORDER BY name ASC'
    )
    res.json(rows.map(toClient))
  } catch (err) {
    console.error('GET /products error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/products — add product
router.post('/', async (req, res) => {
  const { name, price, discount = 0, stock = 0, minThreshold = 0 } = req.body
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' })
  }
  if (!price || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Price must be greater than 0.' })
  }
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, price, discount, stock, min_threshold) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), parseFloat(price), parseFloat(discount), parseInt(stock), parseInt(minThreshold)]
    )
    res.status(201).json({
      id:           result.insertId,
      name:         name.trim(),
      price:        parseFloat(price),
      discount:     parseFloat(discount),
      stock:        parseInt(stock),
      minThreshold: parseInt(minThreshold),
    })
  } catch (err) {
    console.error('POST /products error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// PUT /api/products/:id — update product (logs stock changes to stock_updates)
router.put('/:id', async (req, res) => {
  const { name, price, discount = 0, stock = 0, minThreshold = 0 } = req.body
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' })
  }
  if (!price || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Price must be greater than 0.' })
  }

  const newStock = parseInt(stock, 10) || 0

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    // Lock the row so concurrent requests can't race between read and write
    const [rows] = await conn.query(
      'SELECT stock FROM products WHERE id = ? AND is_deleted = 0 FOR UPDATE',
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Product not found.' })
    }

    const stockDiff = newStock - rows[0].stock

    await conn.query(
      'UPDATE products SET name = ?, price = ?, discount = ?, stock = ?, min_threshold = ? WHERE id = ? AND is_deleted = 0',
      [name.trim(), parseFloat(price), parseFloat(discount), newStock, parseInt(minThreshold, 10) || 0, req.params.id]
    )

    if (stockDiff !== 0) {
      const note = stockDiff > 0
        ? `Admin increased stock by ${stockDiff} units`
        : `Admin decreased stock by ${Math.abs(stockDiff)} units`
      await conn.query(
        "INSERT INTO stock_updates (product_id, updated_by_id, updated_by_role, quantity_added, note) VALUES (?, 1, 'admin', ?, ?)",
        [req.params.id, stockDiff, note]
      )
    }

    await conn.commit()
    res.json({ success: true })
  } catch (err) {
    await conn.rollback()
    console.error('PUT /products/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  } finally {
    conn.release()
  }
})

// DELETE /api/products/:id — soft delete (requires admin password)
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE products SET is_deleted = 1 WHERE id = ?',
      [req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /products/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
