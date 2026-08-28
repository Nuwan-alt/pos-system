const multer = require('multer')

// Memory storage — the buffer goes straight into sharp and then the DB,
// never touches disk (this app stores images as MySQL blobs, not files).
// The 5MB limit and MIME prefilter here are a cheap first-pass reject;
// the *authoritative* check is server/utils/imageProcessing.js reading the
// actual decoded bytes with sharp, since a client can lie about MIME type.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
    }
    cb(null, true)
  },
})

// Wraps upload.single(field) so a Multer error (oversized file, wrong type)
// comes back as this app's normal { error: '...' } JSON shape instead of
// Express's default HTML error page.
function uploadSingleImage(field) {
  const middleware = upload.single(field)
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 5MB or smaller.' })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed.' })
      }
      return res.status(400).json({ error: 'Invalid image upload.' })
    })
  }
}

module.exports = { uploadSingleImage }
