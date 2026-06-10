const db = require('../db/connection')

module.exports = async function verifyAdminPassword(req, res, next) {
  const { adminPassword } = req.body

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required.' })
  }

  try {
    const [rows] = await db.query(
      'SELECT value FROM settings WHERE `key` = ?',
      ['admin_password']
    )

    if (rows.length === 0 || rows[0].value !== adminPassword) {
      return res.status(403).json({ error: 'Incorrect admin password.' })
    }

    next()
  } catch (err) {
    console.error('verifyAdminPassword error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
}
