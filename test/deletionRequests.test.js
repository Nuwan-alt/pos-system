const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

async function createTransaction(qty = 3) {
  const res = await request(app).post('/api/transactions').send({
    cashierId: 1,
    items: [{ productId: 1, productName: 'Test Product A', qty, unitPrice: 100, subtotal: qty * 100 }],
    total: qty * 100,
  })
  return res.body.id
}

describe('Deletion requests API', () => {
  test('a cashier can request deletion of a transaction', async () => {
    const txnId = await createTransaction()
    const res = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    expect(res.status).toBe(201)
  })

  test('a duplicate pending request on the same transaction is rejected', async () => {
    const txnId = await createTransaction()
    await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    const res = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    expect(res.status).toBe(409)
  })

  test('a cashier can cancel their own pending request', async () => {
    const txnId = await createTransaction()
    const created = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    const res = await request(app).delete(`/api/deletion-requests/${created.body.deletionRequestId}`)
    expect(res.status).toBe(200)
  })

  test('admin approval soft-deletes the transaction and restocks the exact qty sold', async () => {
    const txnId = await createTransaction(3) // stock 50 -> 47 after the sale

    const before = await request(app).get('/api/products')
    expect(before.body.find(p => p.id === 1).stock).toBe(47)

    const created = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    const approve = await request(app)
      .patch(`/api/deletion-requests/${created.body.deletionRequestId}/approve`)
      .send({ adminPassword: 'admin123' })
    expect(approve.status).toBe(200)

    const after = await request(app).get('/api/products')
    expect(after.body.find(p => p.id === 1).stock).toBe(50) // fully restored

    const txns = await request(app).get('/api/transactions')
    expect(txns.body).toHaveLength(0) // soft-deleted, excluded from today's list
  })

  test('admin approval requires the correct admin password', async () => {
    const txnId = await createTransaction()
    const created = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    const res = await request(app)
      .patch(`/api/deletion-requests/${created.body.deletionRequestId}/approve`)
      .send({ adminPassword: 'wrong' })
    expect(res.status).toBe(403)
  })

  test('admin rejection marks the request rejected without touching stock', async () => {
    const txnId = await createTransaction(3)
    const created = await request(app).post('/api/deletion-requests').send({ transactionId: txnId })
    const res = await request(app)
      .patch(`/api/deletion-requests/${created.body.deletionRequestId}/reject`)
      .send({ adminPassword: 'admin123' })
    expect(res.status).toBe(200)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 1).stock).toBe(47) // unchanged
  })
})
