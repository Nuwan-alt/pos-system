const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [[sales]] = await db.query(`
      SELECT
        COALESCE(SUM(total), 0) AS todaySales,
        COUNT(*)                AS todayTransactions
      FROM transactions
      WHERE DATE(transaction_time) = CURDATE()
        AND is_deleted = 0
    `)

    const [[cashiers]] = await db.query(
      "SELECT COUNT(*) AS activeCashiers FROM cashiers WHERE status = 'active'"
    )

    const [[products]] = await db.query(
      'SELECT COUNT(*) AS totalProducts FROM products WHERE is_deleted = 0'
    )

    const [[pending]] = await db.query(
      "SELECT COUNT(*) AS pendingDeletions FROM deletion_requests WHERE status = 'pending'"
    )

    res.json({
      todaySales:        parseFloat(sales.todaySales),
      todayTransactions: Number(sales.todayTransactions),
      activeCashiers:    Number(cashiers.activeCashiers),
      totalProducts:     Number(products.totalProducts),
      pendingDeletions:  Number(pending.pendingDeletions),
    })
  } catch (err) {
    console.error('GET /dashboard/stats error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
