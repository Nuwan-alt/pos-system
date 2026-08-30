const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const verifyConfirmCode = require('../middleware/verifyConfirmCode')

// GET /api/deletion-requests/pending — all pending requests (admin view)
router.get('/pending', async (req, res) => {
  try {
    const [requests] = await db.query(`
      SELECT dr.id AS deletion_request_id, dr.requested_at,
             t.id AS txn_id, t.transaction_ref, t.total, t.transaction_time,
             c.name AS cashier_name
      FROM deletion_requests dr
      JOIN  transactions t ON t.id = dr.transaction_id
      LEFT JOIN cashiers c ON c.id  = t.cashier_id
      WHERE dr.status = 'pending'
      ORDER BY dr.requested_at ASC
    `)

    if (requests.length === 0) return res.json([])

    const txnIds = requests.map(r => r.txn_id)
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

    res.json(requests.map(r => ({
      deletionRequestId: r.deletion_request_id,
      transactionRef:    r.transaction_ref,
      cashierName:       r.cashier_name || 'Unknown',
      transactionTime:   new Date(r.transaction_time).toLocaleString(),
      requestedAt:       new Date(r.requested_at).toLocaleString(),
      total:             parseFloat(r.total),
      items:             itemsByTxn[r.txn_id] || [],
    })))
  } catch (err) {
    console.error('GET /deletion-requests/pending error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/deletion-requests — cashier requests deletion
router.post('/', async (req, res) => {
  const { transactionId } = req.body
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required.' })
  }
  try {
    const [existing] = await db.query(
      "SELECT id FROM deletion_requests WHERE transaction_id = ? AND status = 'pending'",
      [transactionId]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A pending deletion request already exists.' })
    }

    const [result] = await db.query(
      "INSERT INTO deletion_requests (transaction_id) VALUES (?)",
      [transactionId]
    )
    res.status(201).json({ deletionRequestId: result.insertId })
  } catch (err) {
    console.error('POST /deletion-requests error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// DELETE /api/deletion-requests/:id — cashier cancels their pending request
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM deletion_requests WHERE id = ? AND status = 'pending'",
      [req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pending deletion request not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /deletion-requests/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// PATCH /api/deletion-requests/:id/approve — admin approves (atomic: soft-delete + restock),
// requires the "123" confirm code
router.patch('/:id/approve', verifyConfirmCode, async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query(
      "SELECT transaction_id FROM deletion_requests WHERE id = ? AND status = 'pending'",
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Pending deletion request not found.' })
    }

    const transactionId = rows[0].transaction_id

    // Soft-delete the transaction
    await conn.query('UPDATE transactions SET is_deleted = 1 WHERE id = ?', [transactionId])

    // Restore stock for every item in the transaction
    const [items] = await conn.query(
      'SELECT product_id, qty FROM transaction_items WHERE transaction_id = ?',
      [transactionId]
    )
    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.qty, item.product_id]
      )
    }

    // Mark request approved
    await conn.query(
      "UPDATE deletion_requests SET status = 'approved', resolved_at = NOW() WHERE id = ?",
      [req.params.id]
    )

    await conn.commit()
    res.json({ success: true })
  } catch (err) {
    await conn.rollback()
    console.error('PATCH /deletion-requests/:id/approve error:', err)
    res.status(500).json({ error: 'Server error.' })
  } finally {
    conn.release()
  }
})

// PATCH /api/deletion-requests/:id/reject — admin rejects, requires the "123" confirm code
router.patch('/:id/reject', verifyConfirmCode, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE deletion_requests SET status = 'rejected', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
      [req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pending deletion request not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('PATCH /deletion-requests/:id/reject error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
