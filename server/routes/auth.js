const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// POST /api/auth/login
// Body: { role: 'admin' | 'cashier', password: string }
router.post('/login', async (req, res) => {
  const { role, password } = req.body

  if (!role || !password) {
    return res.status(400).json({ error: 'Role and password are required.' })
  }

  if (role !== 'admin' && role !== 'cashier') {
    return res.status(400).json({ error: 'Role must be admin or cashier.' })
  }

  try {
    const settingKey = role === 'admin' ? 'admin_password' : 'cashier_password'

    const [rows] = await db.query(
      'SELECT value FROM settings WHERE `key` = ?',
      [settingKey]
    )

    if (rows.length === 0 || rows[0].value !== password) {
      return res.status(401).json({ error: 'Incorrect password.' })
    }

    res.json({ success: true, role })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
