const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// GET /api/transactions — today's non-deleted transactions with deletion status
router.get('/', async (req, res) => {
  try {
    const [txns] = await db.query(`
      SELECT t.id, t.transaction_ref, c.name AS cashier_name,
             t.total, t.transaction_time,
             dr.id AS deletion_request_id
      FROM transactions t
      LEFT JOIN cashiers c ON c.id = t.cashier_id
      LEFT JOIN deletion_requests dr
             ON dr.transaction_id = t.id AND dr.status = 'pending'
      WHERE DATE(t.transaction_time) = CURDATE()
        AND t.is_deleted = 0
      ORDER BY t.transaction_time DESC
    `)

    if (txns.length === 0) return res.json([])

    const txnIds = txns.map(t => t.id)
    const [items] = await db.query(
      `SELECT transaction_id, product_name, qty, unit_price, subtotal
       FROM transaction_items WHERE transaction_id IN (?)`,
      [txnIds]
    )

    const itemsByTxn = {}
    for (const item of items) {
      if (!itemsByTxn[item.transaction_id]) itemsByTxn[item.transaction_id] = []
      itemsByTxn[item.transaction_id].push({
        name:      item.product_name,
        qty:       item.qty,
        unitPrice: parseFloat(item.unit_price),
        subtotal:  parseFloat(item.subtotal),
      })
    }

    res.json(txns.map(t => {
      const d = new Date(t.transaction_time)
      return {
        id:                t.id,
        transactionRef:    t.transaction_ref,
        cashierName:       t.cashier_name || 'Unknown',
        time:              d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        transactionTime:   t.transaction_time,
        total:             parseFloat(t.total),
        items:             itemsByTxn[t.id] || [],
        deletionRequestId: t.deletion_request_id || null,
        deletionStatus:    t.deletion_request_id ? 'pending' : null,
      }
    }))
  } catch (err) {
    console.error('GET /transactions error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/transactions — complete a transaction (atomic: insert + deduct stock)
router.post('/', async (req, res) => {
  const { cashierId, items } = req.body

  if (!cashierId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'cashierId and items are required.' })
  }

  // Recompute qty * unitPrice server-side for every item, and the overall
  // total from those recomputed subtotals — never trust a client-supplied
  // subtotal/total, since a stale or tampered client could record an
  // arbitrary amount that doesn't match what was actually sold.
  const computedItems = []
  let total = 0
  for (const item of items) {
    const qty = parseInt(item.qty, 10)
    const unitPrice = parseFloat(item.unitPrice)
    if (!item.productId || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Each item requires a valid productId, qty, and unitPrice.' })
    }
    const subtotal = Math.round(qty * unitPrice * 100) / 100
    total += subtotal
    computedItems.push({ ...item, qty, unitPrice, subtotal })
  }
  total = Math.round(total * 100) / 100

  const transactionRef = 'TXN' + Date.now()
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()

    const [txnResult] = await conn.query(
      'INSERT INTO transactions (transaction_ref, cashier_id, total) VALUES (?, ?, ?)',
      [transactionRef, cashierId, total]
    )
    const transactionId = txnResult.insertId

    for (const item of computedItems) {
      await conn.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, product_name, qty, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transactionId, item.productId, item.productName, item.qty, item.unitPrice, item.subtotal]
      )
      await conn.query(
        'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
        [item.qty, item.productId]
      )
    }

    await conn.commit()
    res.status(201).json({ id: transactionId, transactionRef })
  } catch (err) {
    await conn.rollback()
    console.error('POST /transactions error:', err)
    res.status(500).json({ error: 'Server error.' })
  } finally {
    conn.release()
  }
})

module.exports = router
