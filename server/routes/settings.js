const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const { encodePassword, decodePassword } = require('../utils/passwordEncoding')

// GET /api/settings/password/cashier — reveal the current cashier password.
// Scoped to cashier only (never admin): the cashier login is already a
// single password shared across all cashiers (see CLAUDE.md Auth section),
// so surfacing it here doesn't widen exposure beyond what cashiers already know.
router.get('/password/cashier', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT value FROM settings WHERE `key` = 'cashier_password'"
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cashier password not set.' })
    }

    res.json({ password: decodePassword(rows[0].value) })
  } catch (err) {
    console.error('GET /settings/password/cashier error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// PATCH /api/settings/password — change admin or cashier password
// Body: { role: 'admin' | 'cashier', currentPassword, newPassword }
router.patch('/password', async (req, res) => {
  const { role, currentPassword, newPassword } = req.body

  if (!role || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'role, currentPassword, and newPassword are required.' })
  }
  if (role !== 'admin' && role !== 'cashier') {
    return res.status(400).json({ error: 'Role must be admin or cashier.' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' })
  }

  const settingKey = role === 'admin' ? 'admin_password' : 'cashier_password'

  try {
    const [rows] = await db.query(
      'SELECT value FROM settings WHERE `key` = ?',
      [settingKey]
    )

    if (rows.length === 0 || rows[0].value !== encodePassword(currentPassword)) {
      return res.status(401).json({ error: 'Incorrect current password.' })
    }

    await db.query(
      'UPDATE settings SET value = ? WHERE `key` = ?',
      [encodePassword(newPassword), settingKey]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('PATCH /settings/password error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
