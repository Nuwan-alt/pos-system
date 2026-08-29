function generateMimicBarcode() {
  // 12-digit random numeric code. No check-digit / industry-prefix
  // structure — a plain unique placeholder, not a real barcode format.
  let code = ''
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10)
  return code
}

function validateBarcode(barcode) {
  if (!barcode) return null
  if (!/^[0-9]{8,32}$/.test(barcode)) {
    return 'Barcode must be 8-32 digits.'
  }
  return null
}

module.exports = { generateMimicBarcode, validateBarcode }
