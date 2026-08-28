// Discount amount must be a non-negative rupee value strictly less than the
// product's price, so the effective price can never hit zero or go negative.
// Shared by POST and PUT /api/products so the rule only lives in one place.
function validateDiscountAmount(price, discountAmount) {
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return 'Discount amount must be a number 0 or greater.'
  }
  if (discountAmount >= price) {
    return 'Discount amount must be less than the product price.'
  }
  return null
}

module.exports = { validateDiscountAmount }
