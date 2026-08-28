const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Dashboard API', () => {
  test("stats reflect today's sales total and transaction count", async () => {
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 }],
      total: 200,
    })
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 2, productName: 'Test Product B', qty: 1, unitPrice: 200, subtotal: 200 }],
      total: 200,
    })

    const res = await request(app).get('/api/dashboard/stats')
    expect(res.status).toBe(200)
    expect(res.body.todaySales).toBe(400)
    expect(res.body.todayTransactions).toBe(2)
    expect(res.body.activeCashiers).toBe(1)
    expect(res.body.totalProducts).toBe(2)
    expect(res.body.pendingDeletions).toBe(0)
  })

  test("a soft-deleted transaction is excluded from today's sales total", async () => {
    const txn = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
    })
    const dr = await request(app).post('/api/deletion-requests').send({ transactionId: txn.body.id })
    await request(app)
      .patch(`/api/deletion-requests/${dr.body.deletionRequestId}/approve`)
      .send({ adminPassword: 'admin123' })

    const res = await request(app).get('/api/dashboard/stats')
    expect(res.body.todaySales).toBe(0)
    expect(res.body.todayTransactions).toBe(0)
  })

  test('pendingDeletions counts only pending requests', async () => {
    const txn = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 100 }],
      total: 100,
    })
    await request(app).post('/api/deletion-requests').send({ transactionId: txn.body.id })

    const res = await request(app).get('/api/dashboard/stats')
    expect(res.body.pendingDeletions).toBe(1)
  })
})
