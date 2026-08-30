const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const verifyAdminPassword = require('../middleware/verifyAdminPassword')
const { encodePassword } = require('../utils/passwordEncoding')

function getLocalDateString() {
  const now = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day   = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Total of that day's completed sales — the drawer only ever closes on the
// same local day it was opened (one row per drawer_date), so this always
// covers exactly the sales made while the drawer was open.
async function getSalesTotal(date) {
  const [[row]] = await db.query(
    'SELECT COALESCE(SUM(total), 0) AS total FROM transactions WHERE DATE(transaction_time) = ? AND is_deleted = 0',
    [date]
  )
  return parseFloat(row.total)
}

// GET /api/drawer/today
router.get('/today', async (req, res) => {
  try {
    const today = getLocalDateString()
    const [rows] = await db.query(
      'SELECT * FROM cash_drawer WHERE drawer_date = ?',
      [today]
    )
    // Included regardless of drawer status so the client can preview what
    // closing would produce before the drawer is actually closed.
    const todaySales = await getSalesTotal(today)
    res.json({ success: true, data: rows.length > 0 ? rows[0] : null, todaySales })
  } catch (err) {
    console.error('GET /drawer/today error:', err)
    res.status(500).json({ error: "Failed to fetch today's drawer." })
  }
})

// POST /api/drawer/open
router.post('/open', async (req, res) => {
  const { opening_amount, note, opened_by_role, opened_by_id, opened_by_name } = req.body

  const parsedOpeningAmount = parseFloat(opening_amount)
  if (!Number.isFinite(parsedOpeningAmount) || parsedOpeningAmount < 0) {
    return res.status(400).json({ error: 'Valid opening amount is required.' })
  }
  if (!opened_by_role || !opened_by_id || !opened_by_name) {
    return res.status(400).json({ error: 'Opener information is required.' })
  }

  try {
    const today = getLocalDateString()

    const [existing] = await db.query(
      'SELECT id FROM cash_drawer WHERE drawer_date = ?',
      [today]
    )
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Drawer has already been opened today.' })
    }

    if (opened_by_role === 'cashier') {
      const [cashier] = await db.query(
        "SELECT id FROM cashiers WHERE id = ? AND status = 'active'",
        [opened_by_id]
      )
      if (cashier.length === 0) {
        return res.status(400).json({ error: 'Cashier not found or inactive.' })
      }
    }

    const [result] = await db.query(
      `INSERT INTO cash_drawer
         (drawer_date, opening_amount, opening_time, opening_note,
          opened_by_role, opened_by_id, opened_by_name, status)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, 'open')`,
      [today, parsedOpeningAmount, note || null,
       opened_by_role, opened_by_id, opened_by_name]
    )

    const [created] = await db.query(
      'SELECT * FROM cash_drawer WHERE id = ?',
      [result.insertId]
    )
    res.json({ success: true, data: created[0] })
  } catch (err) {
    console.error('POST /drawer/open error:', err)
    res.status(500).json({ error: 'Failed to open drawer.' })
  }
})

// POST /api/drawer/close — closing_amount is never taken from the client.
// It's always opening_amount + that day's completed sales, computed here,
// same rule as transactions.total / stock_updates.total_cost elsewhere.
//
// A cashier closing the drawer must additionally re-enter the (shared)
// cashier login password as a confirmation step, since closing finalizes
// the day's cash record — admin closing bypasses this, same as admin
// bypasses verifyAdminPassword on its own actions.
router.post('/close', async (req, res) => {
  const { note, closed_by_role, closed_by_id, closed_by_name, cashierPassword } = req.body

  if (!closed_by_role || !closed_by_id || !closed_by_name) {
    return res.status(400).json({ error: 'Closer information is required.' })
  }

  try {
    const today = getLocalDateString()

    const [existing] = await db.query(
      "SELECT * FROM cash_drawer WHERE drawer_date = ? AND status = 'open'",
      [today]
    )
    if (existing.length === 0) {
      return res.status(400).json({ error: 'No open drawer found for today.' })
    }

    if (closed_by_role === 'cashier') {
      const [cashier] = await db.query(
        "SELECT id FROM cashiers WHERE id = ? AND status = 'active'",
        [closed_by_id]
      )
      if (cashier.length === 0) {
        return res.status(400).json({ error: 'Cashier not found or inactive.' })
      }

      if (!cashierPassword) {
        return res.status(400).json({ error: 'Cashier password is required.' })
      }
      const [settingsRows] = await db.query(
        "SELECT value FROM settings WHERE `key` = 'cashier_password'"
      )
      if (settingsRows.length === 0 || settingsRows[0].value !== encodePassword(cashierPassword)) {
        return res.status(403).json({ error: 'Incorrect cashier password.' })
      }
    }

    const openingAmount = parseFloat(existing[0].opening_amount)
    const todaySales = await getSalesTotal(today)
    const closingAmount = Math.round((openingAmount + todaySales) * 100) / 100

    await db.query(
      `UPDATE cash_drawer SET
         closing_amount = ?,
         closing_time   = NOW(),
         closing_note   = ?,
         closed_by_role = ?,
         closed_by_id   = ?,
         closed_by_name = ?,
         status         = 'closed'
       WHERE drawer_date = ?`,
      [closingAmount, note || null,
       closed_by_role, closed_by_id, closed_by_name, today]
    )

    const [updated] = await db.query(
      'SELECT * FROM cash_drawer WHERE drawer_date = ?',
      [today]
    )
    res.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error('POST /drawer/close error:', err)
    res.status(500).json({ error: 'Failed to close drawer.' })
  }
})

// POST /api/drawer/reset — admin only (verifyAdminPassword reads req.body.adminPassword)
router.post('/reset', verifyAdminPassword, async (req, res) => {
  try {
    const today = getLocalDateString()

    const [existing] = await db.query(
      'SELECT id FROM cash_drawer WHERE drawer_date = ?',
      [today]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No drawer record found for today.' })
    }

    await db.query('DELETE FROM cash_drawer WHERE drawer_date = ?', [today])
    res.json({ success: true, message: 'Drawer reset successfully.' })
  } catch (err) {
    console.error('POST /drawer/reset error:', err)
    res.status(500).json({ error: 'Failed to reset drawer.' })
  }
})

// PUT /api/drawer/:id — admin only, edit a drawer record
router.put('/:id', verifyAdminPassword, async (req, res) => {
  const { id } = req.params
  const { opening_amount, opening_note, closing_amount, closing_note } = req.body

  const parsedOpeningAmount = parseFloat(opening_amount)
  if (!Number.isFinite(parsedOpeningAmount) || parsedOpeningAmount < 0) {
    return res.status(400).json({ error: 'Valid opening amount is required.' })
  }

  let parsedClosingAmount
  if (closing_amount !== undefined && closing_amount !== '') {
    parsedClosingAmount = parseFloat(closing_amount)
    if (!Number.isFinite(parsedClosingAmount) || parsedClosingAmount < 0) {
      return res.status(400).json({ error: 'Valid closing amount is required.' })
    }
  }

  try {
    const [existing] = await db.query('SELECT * FROM cash_drawer WHERE id = ?', [id])
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Drawer record not found.' })
    }

    const record = existing[0]

    if (record.status === 'open') {
      await db.query(
        'UPDATE cash_drawer SET opening_amount = ?, opening_note = ? WHERE id = ?',
        [parsedOpeningAmount, opening_note || null, id]
      )
    } else {
      await db.query(
        `UPDATE cash_drawer SET
           opening_amount = ?, opening_note = ?,
           closing_amount = ?, closing_note = ?
         WHERE id = ?`,
        [
          parsedOpeningAmount,
          opening_note || null,
          parsedClosingAmount !== undefined ? parsedClosingAmount : record.closing_amount,
          closing_note || null,
          id,
        ]
      )
    }

    const [updated] = await db.query('SELECT * FROM cash_drawer WHERE id = ?', [id])
    const row = updated[0]
    res.json({
      success: true,
      data: {
        ...row,
        difference: row.closing_amount !== null
          ? parseFloat(row.closing_amount) - parseFloat(row.opening_amount)
          : null,
      },
    })
  } catch (err) {
    console.error('PUT /drawer/:id error:', err)
    res.status(500).json({ error: 'Failed to update drawer record.' })
  }
})

// GET /api/drawer/history
router.get('/history', async (req, res) => {
  try {
    const { date } = req.query
    let query  = 'SELECT * FROM cash_drawer WHERE 1=1'
    const params = []

    if (date && date.trim() !== '') {
      query += ' AND drawer_date = ?'
      params.push(date.trim())
    }
    query += ' ORDER BY drawer_date DESC'

    const [rows] = await db.query(query, params)

    const data = rows.map(row => ({
      ...row,
      difference: row.closing_amount !== null
        ? parseFloat(row.closing_amount) - parseFloat(row.opening_amount)
        : null,
    }))

    res.json({ success: true, data })
  } catch (err) {
    console.error('GET /drawer/history error:', err)
    res.status(500).json({ error: 'Failed to fetch drawer history.' })
  }
})

module.exports = router
