const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Cash drawer API', () => {
  test('opening the drawer records the exact opening amount', async () => {
    const res = await request(app).post('/api/drawer/open').send({
      opening_amount: 5000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    expect(res.status).toBe(200)
    expect(parseFloat(res.body.data.opening_amount)).toBe(5000)
    expect(res.body.data.status).toBe('open')
  })

  test('the drawer cannot be opened twice on the same day', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const res = await request(app).post('/api/drawer/open').send({
      opening_amount: 2000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    expect(res.status).toBe(400)
  })

  test('closing the drawer computes closing_amount from opening + completed sales', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 }],
      total: 200,
    })

    const res = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(200)
    expect(parseFloat(res.body.data.closing_amount)).toBe(1200) // 1000 opening + 200 sales

    const history = await request(app).get('/api/drawer/history')
    expect(history.body.data[0].difference).toBe(200)
  })

  test('closing ignores any client-supplied closing_amount and recomputes it server-side', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 50, subtotal: 50 }],
      total: 50,
    })

    const res = await request(app).post('/api/drawer/close').send({
      closing_amount: 999999, closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(200)
    expect(parseFloat(res.body.data.closing_amount)).toBe(1050) // 1000 + 50, not the bogus 999999
  })

  test('closing an empty-sales day just returns the opening amount unchanged', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 750, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const res = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(200)
    expect(parseFloat(res.body.data.closing_amount)).toBe(750)
  })

  test('closing requires an already-open drawer for today', async () => {
    const res = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(400)
  })

  test('GET /api/drawer/today includes todaySales for the close-form preview', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 500, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 300, subtotal: 300 }],
      total: 300,
    })

    const res = await request(app).get('/api/drawer/today')
    expect(res.status).toBe(200)
    expect(res.body.todaySales).toBe(300)
  })

  test("reset requires the correct confirm code and removes today's record", async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const bad = await request(app).post('/api/drawer/reset').send({ confirmCode: 'wrong' })
    expect(bad.status).toBe(403)

    const ok = await request(app).post('/api/drawer/reset').send({ confirmCode: '123' })
    expect(ok.status).toBe(200)

    const today = await request(app).get('/api/drawer/today')
    expect(today.body.data).toBeNull()
  })

  test('FIXED: a non-numeric opening amount is rejected with a 400, not a 500', async () => {
    const res = await request(app).post('/api/drawer/open').send({
      opening_amount: 'abc', opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    expect(res.status).toBe(400)
  })

  test('a cashier closing the drawer must confirm with the cashier password', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })

    const missing = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'cashier', closed_by_id: 1, closed_by_name: 'Active Cashier',
    })
    expect(missing.status).toBe(400)

    const wrong = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'cashier', closed_by_id: 1, closed_by_name: 'Active Cashier',
      cashierPassword: 'wrong',
    })
    expect(wrong.status).toBe(403)

    const ok = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'cashier', closed_by_id: 1, closed_by_name: 'Active Cashier',
      cashierPassword: 'cashier123',
    })
    expect(ok.status).toBe(200)
    expect(ok.body.data.status).toBe('closed')
  })

  test('admin closing the drawer never needs a cashier password', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const res = await request(app).post('/api/drawer/close').send({
      closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(200)
  })
})
