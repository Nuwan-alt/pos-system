const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const verifyAdminPassword = require('../middleware/verifyAdminPassword')

function formatDate(datetime) {
  const d = new Date(datetime)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// GET /api/cashiers — all cashiers (for Manage Users page)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, nic, mobile, status, created_at FROM cashiers ORDER BY created_at ASC'
    )
    res.json(rows.map(r => ({
      id:        r.id,
      name:      r.name,
      nic:       r.nic,
      mobile:    r.mobile,
      status:    r.status,
      createdAt: formatDate(r.created_at),
    })))
  } catch (err) {
    console.error('GET /cashiers error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// GET /api/cashiers/active — only active cashiers (for terminal dropdown)
router.get('/active', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name FROM cashiers WHERE status = 'active' ORDER BY name ASC"
    )
    res.json(rows)
  } catch (err) {
    console.error('GET /cashiers/active error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// POST /api/cashiers — create cashier (no admin password required)
router.post('/', async (req, res) => {
  const { name, nic, mobile } = req.body
  if (!name || !name.trim())
    return res.status(400).json({ error: 'Cashier name is required.' })
  if (!nic || !/^([0-9]{9}[vVxX]|[0-9]{12})$/.test(nic.trim()))
    return res.status(400).json({ error: 'Invalid NIC. Use 9 digits + V/X or 12 digits.' })
  if (!mobile || !/^(07[0-9]{8})$/.test(mobile.trim()))
    return res.status(400).json({ error: 'Invalid mobile. Use format 07XXXXXXXX.' })

  try {
    const [dupNic] = await db.query('SELECT id FROM cashiers WHERE nic = ?', [nic.trim()])
    if (dupNic.length > 0)
      return res.status(400).json({ error: 'A cashier with this NIC already exists.' })

    const [dupMobile] = await db.query('SELECT id FROM cashiers WHERE mobile = ?', [mobile.trim()])
    if (dupMobile.length > 0)
      return res.status(400).json({ error: 'A cashier with this mobile number already exists.' })

    const [result] = await db.query(
      "INSERT INTO cashiers (name, nic, mobile, status, created_at) VALUES (?, ?, ?, 'disabled', NOW())",
      [name.trim(), nic.trim(), mobile.trim()]
    )
    const [rows] = await db.query(
      'SELECT id, name, nic, mobile, status, created_at FROM cashiers WHERE id = ?',
      [result.insertId]
    )
    const r = rows[0]
    res.status(201).json({
      id:        r.id,
      name:      r.name,
      nic:       r.nic,
      mobile:    r.mobile,
      status:    r.status,
      createdAt: formatDate(r.created_at),
    })
  } catch (err) {
    console.error('POST /cashiers error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// PATCH /api/cashiers/:id/status — enable or disable (requires admin password)
router.patch('/:id/status', verifyAdminPassword, async (req, res) => {
  const { status } = req.body
  if (status !== 'active' && status !== 'disabled') {
    return res.status(400).json({ error: 'Status must be active or disabled.' })
  }
  try {
    const [result] = await db.query(
      'UPDATE cashiers SET status = ? WHERE id = ?',
      [status, req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cashier not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('PATCH /cashiers/:id/status error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// DELETE /api/cashiers/:id — delete cashier (requires admin password)
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM cashiers WHERE id = ?',
      [req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cashier not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /cashiers/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
