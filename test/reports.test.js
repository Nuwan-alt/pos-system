const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Reports API', () => {
  test('today period aggregates revenue and per-product quantities correctly', async () => {
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [
        { productId: 1, productName: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 },
        { productId: 2, productName: 'Test Product B', qty: 1, unitPrice: 200, subtotal: 200 },
      ],
      total: 400,
    })
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
    })

    const res = await request(app).get('/api/reports?period=today')
    expect(res.status).toBe(200)
    expect(res.body.totalTransactions).toBe(2)
    expect(res.body.totalRevenue).toBe(500)

    const productA = res.body.productRows.find(r => r.name === 'Test Product A')
    expect(productA.qty).toBe(3)
    expect(productA.revenue).toBe(300)
  })

  test('a soft-deleted transaction is excluded from report totals', async () => {
    const txn = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
    })
    const dr = await request(app).post('/api/deletion-requests').send({ transactionId: txn.body.id })
    await request(app)
      .patch(`/api/deletion-requests/${dr.body.deletionRequestId}/approve`)
      .send({ adminPassword: 'admin123' })

    const res = await request(app).get('/api/reports?period=today')
    expect(res.body.totalTransactions).toBe(0)
    expect(res.body.totalRevenue).toBe(0)
  })

  test('rejects an invalid period', async () => {
    const res = await request(app).get('/api/reports?period=bogus')
    expect(res.status).toBe(400)
  })

  test('specificDate requires a valid YYYY-MM-DD date', async () => {
    const res = await request(app).get('/api/reports?period=specificDate&date=not-a-date')
    expect(res.status).toBe(400)
  })

  test('specificDate filters to only that date', async () => {
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
    })

    const today = new Date().toISOString().slice(0, 10)
    const res = await request(app).get(`/api/reports?period=specificDate&date=${today}`)
    expect(res.body.totalTransactions).toBe(1)
  })
})
