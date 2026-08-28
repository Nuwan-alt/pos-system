// Passwords are stored base64-encoded, not hashed — accepted tradeoff for
// this offline single-machine context (see CLAUDE.md Auth section).
function encodePassword(plain) {
  return Buffer.from(String(plain), 'utf8').toString('base64')
}

module.exports = { encodePassword }
