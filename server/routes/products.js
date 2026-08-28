const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const verifyAdminPassword = require('../middleware/verifyAdminPassword')
const { validateDiscountAmount } = require('../utils/pricing')
const { uploadSingleImage } = require('../middleware/upload')
const { processProductImage, assertWithinMaxPacket, ImageValidationError } = require('../utils/imageProcessing')

// NEVER select thumbnail_blob/full_blob here or in any list/search query —
// only GET /:id/image/thumb and GET /:id/image/full may touch those columns.
// has_image + image_version are enough to build a client-usable image URL
// without ever reading the blob itself.
function toClient(r) {
  return {
    id:             r.id,
    name:           r.name,
    price:          parseFloat(r.price),
    discountAmount: parseFloat(r.discount_amount),
    stock:          r.stock,
    minThreshold:   r.min_threshold,
    hasImage:       Boolean(r.has_image),
    thumbnailUrl:   r.has_image ? `/api/products/${r.id}/image/thumb?v=${r.image_version}` : null,
    // Only the admin edit form ever uses this — the cashier terminal must
    // never reference it, even though it costs nothing to include (it's a
    // URL string, not image bytes).
    fullUrl:        r.has_image ? `/api/products/${r.id}/image/full?v=${r.image_version}` : null,
  }
}

const LIST_COLUMNS = 'id, name, price, discount_amount, stock, min_threshold, has_image, image_version'

// GET /api/products — all non-deleted products
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${LIST_COLUMNS} FROM products WHERE is_deleted = 0 ORDER BY name ASC`
    )
    res.json(rows.map(toClient))
  } catch (err) {
    console.error('GET /products error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// GET /api/products/:id/image/thumb — ~200x200, <30KB, used by cashier cards + admin table
router.get('/:id/image/thumb', (req, res) => serveProductImage(req, res, 'thumbnail_blob'))

// GET /api/products/:id/image/full — ~800x800 max, used only by the admin edit form preview
router.get('/:id/image/full', (req, res) => serveProductImage(req, res, 'full_blob'))

// column is always one of the two literals above — never user input, so
// interpolating it into the query text is safe (same pattern as the
// whitelisted period conditions in routes/reports.js).
async function serveProductImage(req, res, column) {
  try {
    // "blob" is a reserved word in MySQL and can't be used bare as an alias.
    const [rows] = await db.query(
      `SELECT ${column} AS img_data, image_mime, has_image, image_version FROM products WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    )
    const row = rows[0]
    if (!row || !row.has_image || !row.img_data) {
      return res.status(404).json({ error: 'Image not found.' })
    }

    const etag = `"${req.params.id}-${row.image_version}"`
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end()
    }

    res.set({
      'Content-Type': row.image_mime || 'image/jpeg',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      ETag: etag,
    })
    res.send(row.img_data)
  } catch (err) {
    console.error('GET product image error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
}

// POST /api/products — add product (multipart/form-data; optional "image" file)
router.post('/', uploadSingleImage('image'), async (req, res) => {
  const { name, price, discountAmount = 0, stock = 0, minThreshold = 0 } = req.body
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' })
  }
  const parsedPrice = parseFloat(price)
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a number greater than 0.' })
  }
  const parsedDiscountAmount = parseFloat(discountAmount)
  const discountError = validateDiscountAmount(parsedPrice, parsedDiscountAmount)
  if (discountError) {
    return res.status(400).json({ error: discountError })
  }

  try {
    let thumbnailBlob = null, fullBlob = null, imageMime = null, hasImage = 0, imageVersion = 0
    if (req.file) {
      const processed = await processProductImage(req.file.buffer)
      await assertWithinMaxPacket(db, processed.thumbnailBuffer.length + processed.fullBuffer.length)
      thumbnailBlob = processed.thumbnailBuffer
      fullBlob      = processed.fullBuffer
      imageMime     = processed.mimeType
      hasImage      = 1
      imageVersion  = 1
    }

    // One atomic INSERT — image processing failures 400 above, before any
    // row exists, so a bad upload never leaves a half-created product.
    const [result] = await db.query(
      `INSERT INTO products
         (name, price, discount_amount, stock, min_threshold, thumbnail_blob, full_blob, image_mime, has_image, image_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), parsedPrice, parsedDiscountAmount, parseInt(stock), parseInt(minThreshold),
       thumbnailBlob, fullBlob, imageMime, hasImage, imageVersion]
    )

    const [rows] = await db.query(`SELECT ${LIST_COLUMNS} FROM products WHERE id = ?`, [result.insertId])
    res.status(201).json(toClient(rows[0]))
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return res.status(400).json({ error: err.message })
    }
    console.error('POST /products error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// PUT /api/products/:id — update product details (stock is managed via POST /api/stock/adjust)
// multipart/form-data: an "image" file replaces the current image; a
// removeImage=true field clears it; neither leaves the image untouched.
router.put('/:id', uploadSingleImage('image'), async (req, res) => {
  const { name, price, discountAmount = 0, minThreshold = 0, removeImage } = req.body
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' })
  }
  const parsedPrice = parseFloat(price)
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a number greater than 0.' })
  }
  const parsedDiscountAmount = parseFloat(discountAmount)
  const discountError = validateDiscountAmount(parsedPrice, parsedDiscountAmount)
  if (discountError) {
    return res.status(400).json({ error: discountError })
  }

  try {
    const setClauses = ['name = ?', 'price = ?', 'discount_amount = ?', 'min_threshold = ?']
    const params = [name.trim(), parsedPrice, parsedDiscountAmount, parseInt(minThreshold, 10) || 0]

    if (req.file) {
      const processed = await processProductImage(req.file.buffer)
      await assertWithinMaxPacket(db, processed.thumbnailBuffer.length + processed.fullBuffer.length)
      setClauses.push('thumbnail_blob = ?', 'full_blob = ?', 'image_mime = ?', 'has_image = ?', 'image_version = image_version + 1')
      params.push(processed.thumbnailBuffer, processed.fullBuffer, processed.mimeType, 1)
    } else if (removeImage === 'true') {
      setClauses.push('thumbnail_blob = NULL', 'full_blob = NULL', 'image_mime = NULL', 'has_image = ?', 'image_version = image_version + 1')
      params.push(0)
    }

    params.push(req.params.id)

    const [result] = await db.query(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND is_deleted = 0`,
      params
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' })
    }

    const [rows] = await db.query(`SELECT ${LIST_COLUMNS} FROM products WHERE id = ?`, [req.params.id])
    res.json(toClient(rows[0]))
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return res.status(400).json({ error: err.message })
    }
    console.error('PUT /products/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// DELETE /api/products/:id — soft delete (requires admin password); also
// clears image data, since a soft-deleted product is never shown again.
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE products SET is_deleted = 1, thumbnail_blob = NULL, full_blob = NULL, image_mime = NULL, has_image = 0 WHERE id = ?',
      [req.params.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found.' })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /products/:id error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

module.exports = router
