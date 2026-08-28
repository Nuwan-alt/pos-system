const sharp = require('sharp')

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const THUMBNAIL_SIZE = 200
const THUMBNAIL_MAX_BYTES = 30 * 1024
const FULL_MAX_SIZE = 800
const OUTPUT_MIME = 'image/jpeg'

class ImageValidationError extends Error {}

// Validates by actually decoding the bytes with sharp — never trusts the
// file extension or the client-supplied Content-Type — then produces two
// JPEGs (thumbnail + full) with EXIF stripped and orientation baked in.
// Throws ImageValidationError (-> 400) for anything that isn't a real,
// supported image; never lets a bad upload reach the database.
async function processProductImage(buffer) {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError(`Image must be ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB or smaller.`)
  }

  let metadata
  try {
    metadata = await sharp(buffer).metadata()
  } catch {
    throw new ImageValidationError('File is not a valid image.')
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new ImageValidationError('Only JPEG, PNG, and WebP images are allowed.')
  }

  // .rotate() with no args bakes in the EXIF orientation tag before we
  // discard it — otherwise a photo taken on its side would render sideways
  // once we strip the metadata that told the browser how to rotate it.
  // sharp doesn't preserve any other metadata unless .withMetadata() is
  // called, which we deliberately never do — this is the EXIF strip.
  const base = sharp(buffer).rotate()

  const fullBuffer = await base
    .clone()
    .resize(FULL_MAX_SIZE, FULL_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer()

  const thumbnailBuffer = await makeThumbnail(base)

  return { thumbnailBuffer, fullBuffer, mimeType: OUTPUT_MIME }
}

// 200x200 cover-crop, quality stepped down until it's actually under the
// 30KB target rather than just hoping a fixed quality gets there.
async function makeThumbnail(base) {
  let smallestSoFar
  for (const quality of [70, 55, 40, 30]) {
    const buf = await base
      .clone()
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' })
      .jpeg({ quality })
      .toBuffer()
    if (buf.length <= THUMBNAIL_MAX_BYTES) return buf
    smallestSoFar = buf
  }
  return smallestSoFar
}

let cachedMaxPacket = null

// Confirms the row we're about to write fits within the server's configured
// max_allowed_packet, so an oversized combination of thumbnail+full+other
// columns fails with a clear error instead of a raw mysql2 packet error.
async function assertWithinMaxPacket(db, totalBytes) {
  if (cachedMaxPacket === null) {
    const [rows] = await db.query("SHOW VARIABLES LIKE 'max_allowed_packet'")
    cachedMaxPacket = rows.length > 0 ? parseInt(rows[0].Value, 10) : Infinity
  }
  // Leave headroom for the query text and the row's other columns.
  const safetyMargin = 64 * 1024
  if (totalBytes + safetyMargin > cachedMaxPacket) {
    throw new ImageValidationError(
      `Image is too large for the database's max_allowed_packet setting (${Math.floor(cachedMaxPacket / 1024)}KB). Try a smaller image.`
    )
  }
}

module.exports = { processProductImage, assertWithinMaxPacket, ImageValidationError }
