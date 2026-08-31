// A lightweight confirmation gate, not authentication — admin is already
// logged in with the real admin password; re-entering it for routine
// actions (enable/disable a cashier, approve/reject a deletion request,
// deleting a product, resetting the drawer) was judged unnecessary
// friction. This is a deliberate, accepted tradeoff for this offline
// single-machine context, same spirit as passwordEncoding.js's
// base64-not-hashed choice. Deleting a cashier account and editing a
// closed drawer's amounts are the only actions still gated by the real
// admin password (verifyAdminPassword) — deleting a cashier destroys a
// login credential, and drawer edit rewrites the finalized cash record.
const CONFIRM_CODE = '123'

module.exports = function verifyConfirmCode(req, res, next) {
  const { confirmCode } = req.body

  if (!confirmCode) {
    return res.status(400).json({ error: 'Confirmation code is required.' })
  }
  if (confirmCode !== CONFIRM_CODE) {
    return res.status(403).json({ error: 'Incorrect confirmation code.' })
  }

  next()
}
