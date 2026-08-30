const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Stock API', () => {
  test('POST /api/stock/adjust "add" increases stock and logs a positive delta', async () => {
    const res = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'add', quantity: 10, buyingPricePerUnit: 50, note: 'Restock',
    })
    expect(res.status).toBe(200)
    expect(res.body.new_stock).toBe(60) // 50 + 10

    const history = await request(app).get('/api/stock/history')
    expect(history.body.data[0].quantity_added).toBe(10)
    expect(history.body.data[0].updated_by_role).toBe('admin')
  })

  test('POST /api/stock/adjust "add" requires a buying price and rejects it when missing or negative', async () => {
    const missing = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'add', quantity: 10,
    })
    expect(missing.status).toBe(400)

    const negative = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'add', quantity: 10, buyingPricePerUnit: -5,
    })
    expect(negative.status).toBe(400)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 1).stock).toBe(50) // unchanged by either rejected attempt
  })

  test('POST /api/stock/adjust "add" recomputes total_cost server-side and never trusts a client-supplied one', async () => {
    const res = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'add', quantity: 4, buyingPricePerUnit: 12.5, totalCost: 999999,
    })
    expect(res.status).toBe(200)

    const history = await request(app).get('/api/stock/history')
    expect(history.body.data[0].buying_price_per_unit).toBe('12.50')
    expect(history.body.data[0].total_cost).toBe('50.00') // 4 * 12.5, not the bogus client value
  })

  test('POST /api/stock/adjust "remove" ignores any buying price sent and stores no cost data', async () => {
    const res = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'remove', quantity: 5, buyingPricePerUnit: 40,
    })
    expect(res.status).toBe(200)

    const history = await request(app).get('/api/stock/history')
    expect(history.body.data[0].buying_price_per_unit).toBeNull()
    expect(history.body.data[0].total_cost).toBeNull()
  })

  test('POST /api/stock/adjust "remove" decreases stock and logs a negative delta', async () => {
    const res = await request(app).post('/api/stock/adjust').send({
      product_id: 1, operation: 'remove', quantity: 20,
    })
    expect(res.status).toBe(200)
    expect(res.body.new_stock).toBe(30) // 50 - 20

    const history = await request(app).get('/api/stock/history')
    expect(history.body.data[0].quantity_added).toBe(-20)
  })

  test('POST /api/stock/adjust "remove" rejects removing more than is in stock', async () => {
    const res = await request(app).post('/api/stock/adjust').send({
      product_id: 2, operation: 'remove', quantity: 999,
    })
    expect(res.status).toBe(400)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 2).stock).toBe(5) // unchanged
  })

  test('POST /api/stock/update applies a signed delta from an active cashier', async () => {
    const res = await request(app).post('/api/stock/update').send({
      product_id: 1, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: -5, note: 'Damaged',
    })
    expect(res.status).toBe(201)
    expect(res.body.new_stock).toBe(45)
  })

  test('POST /api/stock/update requires a buying price for a positive delta and computes total_cost', async () => {
    const missing = await request(app).post('/api/stock/update').send({
      product_id: 1, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: 8,
    })
    expect(missing.status).toBe(400)

    const ok = await request(app).post('/api/stock/update').send({
      product_id: 1, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: 8, buyingPricePerUnit: 15,
    })
    expect(ok.status).toBe(201)

    const history = await request(app).get('/api/stock/history')
    expect(history.body.data[0].buying_price_per_unit).toBe('15.00')
    expect(history.body.data[0].total_cost).toBe('120.00') // 8 * 15
  })

  test('POST /api/stock/update rejects an inactive cashier', async () => {
    const res = await request(app).post('/api/stock/update').send({
      product_id: 1, updated_by_id: 2, updated_by_role: 'cashier', quantity_added: 5, buyingPricePerUnit: 10,
    })
    expect(res.status).toBe(400)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 1).stock).toBe(50) // unchanged
  })

  test('POST /api/stock/update rejects a delta that would drive stock negative', async () => {
    const res = await request(app).post('/api/stock/update').send({
      product_id: 2, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: -50,
    })
    expect(res.status).toBe(400)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 2).stock).toBe(5) // unchanged
  })

  test('POST /api/stock/update rejects a zero quantity_added', async () => {
    const res = await request(app).post('/api/stock/update').send({
      product_id: 1, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: 0,
    })
    expect(res.status).toBe(400)
  })

  test('GET /api/stock/history filters by role', async () => {
    await request(app).post('/api/stock/adjust').send({ product_id: 1, operation: 'add', quantity: 5, buyingPricePerUnit: 10 })
    await request(app).post('/api/stock/update').send({
      product_id: 2, updated_by_id: 1, updated_by_role: 'cashier', quantity_added: 2, buyingPricePerUnit: 5,
    })

    const adminOnly = await request(app).get('/api/stock/history?role=admin')
    expect(adminOnly.body.data).toHaveLength(1)
    expect(adminOnly.body.data[0].updated_by_role).toBe('admin')

    const cashierOnly = await request(app).get('/api/stock/history?role=cashier')
    expect(cashierOnly.body.data).toHaveLength(1)
    expect(cashierOnly.body.data[0].updater_name).toBe('Active Cashier')
  })
})
