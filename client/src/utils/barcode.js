export function generateMimicBarcode() {
  let code = ''
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10)
  return code
}
