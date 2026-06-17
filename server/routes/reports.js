const express = require('express')
const router = express.Router()
const db = require('../db/connection')

const PERIOD_CONDITIONS = {
  today:     'DATE(t.transaction_time) = CURDATE()',
  yesterday: 'DATE(t.transaction_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)',
  last7:     'DATE(t.transaction_time) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
  thisMonth: 'YEAR(t.transaction_time) = YEAR(NOW()) AND MONTH(t.transaction_time) = MONTH(NOW())',
  thisYear:  'YEAR(t.transaction_time) = YEAR(NOW())',
}

// GET /api/reports?period=today|yesterday|last7|thisMonth|thisYear|specificDate[&date=YYYY-MM-DD]
router.get('/', async (req, res) => {
  const { period = 'today', date } = req.query

  let cond
  let condParams = []

  if (period === 'specificDate') {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid or missing date. Use YYYY-MM-DD.' })
    }
    cond = 'DATE(t.transaction_time) = ?'
    condParams = [date]
  } else {
    if (!PERIOD_CONDITIONS[period]) {
      return res.status(400).json({ error: 'Invalid period.' })
    }
    // Safe to interpolate — period is validated against a fixed whitelist above
    cond = PERIOD_CONDITIONS[period]
  }

  try {
    const [[summary]] = await db.query(
      `SELECT
         COUNT(*)                AS totalTransactions,
         COALESCE(SUM(total), 0) AS totalRevenue
       FROM transactions t
       WHERE ${cond} AND t.is_deleted = 0`,
      condParams,
    )

    const [rows] = await db.query(
      `SELECT
         ti.product_name   AS name,
         SUM(ti.qty)       AS qty,
         SUM(ti.subtotal)  AS revenue
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE ${cond} AND t.is_deleted = 0
       GROUP BY ti.product_name
       ORDER BY revenue DESC`,
      condParams,
    )

    res.json({
      totalTransactions: Number(summary.totalTransactions),
      totalRevenue:      parseFloat(summary.totalRevenue),
      productRows:       rows.map(r => ({
        name:    r.name,
        qty:     Number(r.qty),
        revenue: parseFloat(r.revenue),
      })),
    })
  } catch (err) {
    console.error('GET /reports error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
