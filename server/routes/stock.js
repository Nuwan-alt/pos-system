const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// GET /api/stock/history
router.get('/history', async (req, res) => {
  const { search, role, date } = req.query

  let query = `
    SELECT
      su.id,
      p.name AS product_name,
      su.updated_by_id,
      su.updated_by_role,
      CASE
        WHEN su.updated_by_role = 'cashier' THEN c.name
        WHEN su.updated_by_role = 'admin'   THEN 'Admin'
      END AS updater_name,
      su.quantity_added,
      su.buying_price_per_unit,
      su.total_cost,
      su.note,
      su.updated_at
    FROM stock_updates su
    JOIN products p ON su.product_id = p.id
    LEFT JOIN cashiers c
      ON su.updated_by_role = 'cashier'
      AND su.updated_by_id = c.id
    WHERE 1=1
  `
  const params = []

  if (search && search.trim() !== '') {
    query += ` AND (
      p.name LIKE ? OR
      CASE
        WHEN su.updated_by_role = 'cashier' THEN c.name
        WHEN su.updated_by_role = 'admin'   THEN 'Admin'
      END LIKE ?
    )`
    params.push(`%${search.trim()}%`, `%${search.trim()}%`)
  }

  if (role && role !== 'all') {
    query += ` AND su.updated_by_role = ?`
    params.push(role.toLowerCase())
  }

  if (date && date.trim() !== '') {
    query += ` AND DATE(su.updated_at) = ?`
    params.push(date.trim())
  }

  query += ` ORDER BY su.updated_at DESC`

  try {
    const [rows] = await db.query(query, params)
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('GET /stock/history error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/stock/adjust — admin add/remove stock with audit log
router.post('/adjust', async (req, res) => {
  const { product_id, operation, quantity, buyingPricePerUnit, note } = req.body

  const qty = parseInt(quantity, 10)
  if (!product_id || !operation || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Invalid request data.' })
  }
  if (operation !== 'add' && operation !== 'remove') {
    return res.status(400).json({ error: 'operation must be "add" or "remove".' })
  }

  // A top-up is always a purchase in this shop's workflow — buying price is
  // required. A removal (damage/shrinkage/correction) is never a purchase,
  // so cost fields never apply there.
  let unitCost = null
  if (operation === 'add') {
    const rate = parseFloat(buyingPricePerUnit)
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ error: 'Buying price per unit is required and must be 0 or greater.' })
    }
    unitCost = rate
  }
  // Recomputed server-side, never trusted from the client — same rule as
  // transactions.total.
  const totalCost = unitCost !== null ? Math.round(qty * unitCost * 100) / 100 : null

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query(
      'SELECT stock FROM products WHERE id = ? AND is_deleted = 0 FOR UPDATE',
      [product_id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Product not found.' })
    }

    const currentStock = rows[0].stock
    if (operation === 'remove' && qty > currentStock) {
      await conn.rollback()
      return res.status(400).json({
        error: `Cannot remove ${qty} units. Only ${currentStock} in stock.`,
      })
    }

    const newStock      = operation === 'add' ? currentStock + qty : currentStock - qty
    const signedQty     = operation === 'add' ? qty : -qty
    const autoNote      = operation === 'add'
      ? `Admin added ${qty} units`
      : `Admin removed ${qty} units`

    await conn.query(
      'UPDATE products SET stock = ? WHERE id = ? AND is_deleted = 0',
      [newStock, product_id]
    )
    await conn.query(
      `INSERT INTO stock_updates
         (product_id, updated_by_id, updated_by_role, quantity_added, buying_price_per_unit, total_cost, note)
       VALUES (?, 1, 'admin', ?, ?, ?, ?)`,
      [product_id, signedQty, unitCost, totalCost, note?.trim() || autoNote]
    )

    await conn.commit()
    res.json({ success: true, new_stock: newStock })
  } catch (err) {
    await conn.rollback()
    console.error('POST /stock/adjust error:', err)
    res.status(500).json({ error: 'Server error.' })
  } finally {
    conn.release()
  }
})

// POST /api/stock/update
router.post('/update', async (req, res) => {
  const { product_id, updated_by_id, updated_by_role, quantity_added, buyingPricePerUnit, note = null } = req.body

  if (!product_id) {
    return res.status(400).json({ error: 'product_id is required.' })
  }
  if (!updated_by_id) {
    return res.status(400).json({ error: 'updated_by_id is required.' })
  }
  if (updated_by_role !== 'cashier' && updated_by_role !== 'admin') {
    return res.status(400).json({ error: 'updated_by_role must be "cashier" or "admin".' })
  }
  if (!Number.isInteger(quantity_added) || quantity_added === 0) {
    return res.status(400).json({ error: 'quantity_added must be a non-zero integer.' })
  }

  // A top-up (positive delta) is always a purchase in this shop's workflow —
  // buying price is required. A removal is never a purchase.
  let unitCost = null
  if (quantity_added > 0) {
    const rate = parseFloat(buyingPricePerUnit)
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ error: 'Buying price per unit is required and must be 0 or greater.' })
    }
    unitCost = rate
  }
  const totalCost = unitCost !== null ? Math.round(quantity_added * unitCost * 100) / 100 : null

  // Verify the actor exists and is eligible
  if (updated_by_role === 'cashier') {
    const [rows] = await db.query(
      "SELECT id FROM cashiers WHERE id = ? AND status = 'active'",
      [updated_by_id]
    )
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Cashier not found or not active.' })
    }
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [product] = await conn.query(
      'SELECT stock FROM products WHERE id = ? AND is_deleted = 0 FOR UPDATE',
      [product_id]
    )
    if (product.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Product not found.' })
    }

    const newStock = product[0].stock + quantity_added
    if (newStock < 0) {
      await conn.rollback()
      return res.status(400).json({
        error: `Cannot remove ${Math.abs(quantity_added)} units. Only ${product[0].stock} in stock.`,
      })
    }

    await conn.query(
      'UPDATE products SET stock = ? WHERE id = ? AND is_deleted = 0',
      [newStock, product_id]
    )
    await conn.query(
      `INSERT INTO stock_updates
         (product_id, updated_by_id, updated_by_role, quantity_added, buying_price_per_unit, total_cost, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, updated_by_id, updated_by_role, quantity_added, unitCost, totalCost, note ?? null]
    )

    await conn.commit()
    res.status(201).json({ success: true, new_stock: newStock })
  } catch (err) {
    await conn.rollback()
    console.error('POST /stock/update error:', err)
    res.status(500).json({ error: 'Server error.' })
  } finally {
    conn.release()
  }
})

module.exports = router
