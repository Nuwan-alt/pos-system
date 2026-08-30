// A lightweight confirmation gate, not authentication — admin is already
// logged in with the real admin password; re-entering it for routine
// actions (enable/disable a cashier, approve/reject a deletion request) was
// judged unnecessary friction. This is a deliberate, accepted tradeoff for
// this offline single-machine context, same spirit as passwordEncoding.js's
// base64-not-hashed choice. Harder-to-undo actions (deleting a cashier
// account, drawer reset/edit) still go through verifyAdminPassword.
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
