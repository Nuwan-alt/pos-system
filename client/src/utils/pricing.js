// Single source of truth for "price minus discount" — every screen that
// shows a discounted price (cashier cart/cards, admin form/table) computes
// it through this instead of repeating the subtraction inline.
export function getEffectivePrice(price, discountAmount) {
  const amount = discountAmount || 0
  return Math.round((price - amount) * 100) / 100
}
