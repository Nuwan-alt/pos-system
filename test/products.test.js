const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool, getPool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

// A minimal but genuinely valid 1x1 PNG — real decodable image bytes, not
// just a file named ".png". Used to exercise the actual sharp pipeline.
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

describe('Products API', () => {
  test('GET /api/products returns non-deleted products with correct numeric types', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 1, name: 'Test Product A', price: 100, discountAmount: 0, stock: 50, minThreshold: 10, hasImage: false, thumbnailUrl: null, fullUrl: null },
      { id: 2, name: 'Test Product B', price: 200, discountAmount: 20, stock: 5, minThreshold: 10, hasImage: false, thumbnailUrl: null, fullUrl: null },
    ])
  })

  test('POST /api/products creates a product with correctly parsed numeric fields', async () => {
    const res = await request(app).post('/api/products').send({
      name: 'New Product', price: '49.99', discountAmount: '5', stock: '20', minThreshold: '3',
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'New Product', price: 49.99, discountAmount: 5, stock: 20, minThreshold: 3,
    })

    const list = await request(app).get('/api/products')
    expect(list.body.find(p => p.name === 'New Product')).toBeTruthy()
  })

  test('POST /api/products rejects a missing name', async () => {
    const res = await request(app).post('/api/products').send({ price: 10 })
    expect(res.status).toBe(400)
  })

  test('POST /api/products rejects price <= 0', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad', price: 0 })
    expect(res.status).toBe(400)
  })

  test('POST /api/products rejects a negative discount amount', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad Discount', price: 100, discountAmount: -5 })
    expect(res.status).toBe(400)
  })

  test('POST /api/products rejects a discount amount equal to the price (would zero out the final price)', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad Discount', price: 100, discountAmount: 100 })
    expect(res.status).toBe(400)
  })

  test('POST /api/products rejects a discount amount greater than the price', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad Discount', price: 100, discountAmount: 150 })
    expect(res.status).toBe(400)
  })

  test('FIXED: a non-numeric price string is rejected with a 400, not a 500', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad Price', price: 'abc' })
    expect(res.status).toBe(400)
  })

  test('PUT /api/products/:id updates details but never touches stock', async () => {
    const res = await request(app).put('/api/products/1').send({
      name: 'Renamed', price: 150, discountAmount: 20, minThreshold: 15,
    })
    expect(res.status).toBe(200)

    const list = await request(app).get('/api/products')
    const p = list.body.find(x => x.id === 1)
    expect(p.name).toBe('Renamed')
    expect(p.price).toBe(150)
    expect(p.discountAmount).toBe(20)
    expect(p.minThreshold).toBe(15)
    expect(p.stock).toBe(50)
  })

  test('FIXED: PUT /api/products/:id also rejects a non-numeric price with a 400', async () => {
    const res = await request(app).put('/api/products/1').send({ name: 'X', price: 'abc' })
    expect(res.status).toBe(400)
  })

  test('PUT /api/products/:id rejects a discount amount that would zero out or exceed the price', async () => {
    const res = await request(app).put('/api/products/1').send({ name: 'X', price: 100, discountAmount: 100 })
    expect(res.status).toBe(400)
  })

  test('PUT /api/products/:id 404s for a missing product', async () => {
    const res = await request(app).put('/api/products/999').send({ name: 'X', price: 10 })
    expect(res.status).toBe(404)
  })

  test('DELETE /api/products/:id requires the correct admin password and soft-deletes', async () => {
    const bad = await request(app).delete('/api/products/1').send({ adminPassword: 'wrong' })
    expect(bad.status).toBe(403)

    const ok = await request(app).delete('/api/products/1').send({ adminPassword: 'admin123' })
    expect(ok.status).toBe(200)

    const list = await request(app).get('/api/products')
    expect(list.body.find(p => p.id === 1)).toBeUndefined()
  })
})

describe('Product images', () => {
  test('POST /api/products with a valid image sets hasImage and both URLs', async () => {
    const res = await request(app)
      .post('/api/products')
      .field('name', 'Product With Image')
      .field('price', '99.99')
      .attach('image', VALID_PNG, 'test.png')

    expect(res.status).toBe(201)
    expect(res.body.hasImage).toBe(true)
    expect(res.body.thumbnailUrl).toMatch(new RegExp(`^/api/products/${res.body.id}/image/thumb\\?v=\\d+$`))
    expect(res.body.fullUrl).toMatch(new RegExp(`^/api/products/${res.body.id}/image/full\\?v=\\d+$`))
  })

  test('POST /api/products with no image leaves hasImage false, exactly as before', async () => {
    const res = await request(app).post('/api/products').send({ name: 'No Image Product', price: 50 })
    expect(res.status).toBe(201)
    expect(res.body.hasImage).toBe(false)
    expect(res.body.thumbnailUrl).toBeNull()
    expect(res.body.fullUrl).toBeNull()
  })

  test('UNUSUAL check: non-image bytes with a convincing filename/MIME are rejected by content, not extension', async () => {
    const res = await request(app)
      .post('/api/products')
      .field('name', 'Fake Image')
      .field('price', '10')
      .attach('image', Buffer.from('this is definitely not an image'), { filename: 'totally-real.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)

    // And no product was created — a bad image must not leave a half-created record.
    const list = await request(app).get('/api/products')
    expect(list.body.find(p => p.name === 'Fake Image')).toBeUndefined()
  })

  test('rejects an image over 5MB', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 0)
    const res = await request(app)
      .post('/api/products')
      .field('name', 'Too Big')
      .field('price', '10')
      .attach('image', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
  })

  test('GET /:id/image/thumb serves the thumbnail with a JPEG Content-Type and supports conditional GET', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Thumb Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')

    const res = await request(app).get(`/api/products/${created.body.id}/image/thumb`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['etag']).toBeTruthy()
    expect(res.body.length).toBeGreaterThan(0)
    // Output is re-encoded JPEG regardless of the PNG input — a real decode happened.
    expect(res.body.length).toBeLessThan(30 * 1024)

    const conditional = await request(app)
      .get(`/api/products/${created.body.id}/image/thumb`)
      .set('If-None-Match', res.headers['etag'])
    expect(conditional.status).toBe(304)
  })

  test('GET /:id/image/full serves the full-size image', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Full Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')

    const res = await request(app).get(`/api/products/${created.body.id}/image/full`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
  })

  test('GET /:id/image/thumb 404s (not 500) for a product with no image', async () => {
    const res = await request(app).get('/api/products/1/image/thumb')
    expect(res.status).toBe(404)
  })

  test('GET /:id/image/full 404s for a nonexistent product', async () => {
    const res = await request(app).get('/api/products/999/image/full')
    expect(res.status).toBe(404)
  })

  test('PUT can replace an existing image', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Replace Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')
    const firstUrl = created.body.thumbnailUrl

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .field('name', 'Replace Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test2.png')

    expect(updated.status).toBe(200)
    expect(updated.body.hasImage).toBe(true)
    // updated_at moved, so the cache-busting version in the URL changed too.
    expect(updated.body.thumbnailUrl).not.toBe(firstUrl)
  })

  test('PUT with removeImage=true clears an existing image', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Remove Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')
    expect(created.body.hasImage).toBe(true)

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .field('name', 'Remove Test')
      .field('price', '10')
      .field('removeImage', 'true')

    expect(updated.status).toBe(200)
    expect(updated.body.hasImage).toBe(false)
    expect(updated.body.thumbnailUrl).toBeNull()

    const img = await request(app).get(`/api/products/${created.body.id}/image/thumb`)
    expect(img.status).toBe(404)
  })

  test('PUT without a file or removeImage leaves an existing image untouched', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Untouched Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .send({ name: 'Untouched Test Renamed', price: 10 })

    expect(updated.status).toBe(200)
    expect(updated.body.hasImage).toBe(true)
    // image_version is dedicated to the image itself, so a text-only edit
    // must not bump it — the URL should be byte-for-byte identical.
    expect(updated.body.thumbnailUrl).toBe(created.body.thumbnailUrl)
  })

  test('DELETE clears the stored image bytes, not just is_deleted', async () => {
    const created = await request(app)
      .post('/api/products')
      .field('name', 'Delete Image Test')
      .field('price', '10')
      .attach('image', VALID_PNG, 'test.png')

    await request(app).delete(`/api/products/${created.body.id}`).send({ adminPassword: 'admin123' })

    const [rows] = await getPool().query(
      'SELECT has_image, thumbnail_blob, full_blob FROM products WHERE id = ?',
      [created.body.id]
    )
    expect(rows[0].has_image).toBe(0)
    expect(rows[0].thumbnail_blob).toBeNull()
    expect(rows[0].full_blob).toBeNull()
  })
})
