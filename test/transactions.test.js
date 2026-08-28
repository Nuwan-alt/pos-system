const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Transactions API', () => {
  test('POST /api/transactions deducts stock by exactly the purchased qty', async () => {
    const res = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 3, unitPrice: 100, subtotal: 300 }],
      total: 300,
    })
    expect(res.status).toBe(201)
    expect(res.body.transactionRef).toMatch(/^TXN\d+$/)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 1).stock).toBe(47) // 50 - 3
  })

  test('POST /api/transactions deducts stock for multiple line items independently', async () => {
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [
        { productId: 1, productName: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 },
        { productId: 2, productName: 'Test Product B', qty: 1, unitPrice: 200, subtotal: 200 },
      ],
      total: 400,
    })

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 1).stock).toBe(48)
    expect(products.body.find(p => p.id === 2).stock).toBe(4)
  })

  test("GET /api/transactions lists today's sale with correct total and line items", async () => {
    await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 }],
      total: 200,
    })

    const res = await request(app).get('/api/transactions')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].total).toBe(200)
    expect(res.body[0].items).toEqual([
      { name: 'Test Product A', qty: 2, unitPrice: 100, subtotal: 200 },
    ])
    expect(res.body[0].cashierName).toBe('Active Cashier')
  })

  test('POST /api/transactions rejects an empty items array', async () => {
    const res = await request(app).post('/api/transactions').send({ cashierId: 1, items: [], total: 0 })
    expect(res.status).toBe(400)
  })

  test('UNUSUAL: the API itself never checks available stock before selling — the cashier UI does this instead', async () => {
    // CashierTerminal.jsx's `hasStockIssue` check disables "Complete Transaction"
    // client-side, so this isn't reachable through the normal app flow. But the
    // API has no server-side check of its own — unlike /api/stock/adjust and
    // /api/stock/update, which do check — so a direct API call, or a race between
    // two near-simultaneous submissions against the same cached stock snapshot,
    // can still oversell.
    const res = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 2, productName: 'Test Product B', qty: 999, unitPrice: 200, subtotal: 199800 }],
      total: 199800,
    })
    expect(res.status).toBe(201)

    const products = await request(app).get('/api/products')
    expect(products.body.find(p => p.id === 2).stock).toBe(0)
  })

  test('FIXED: the server recomputes total/subtotals from qty * unitPrice, ignoring a mismatched client total', async () => {
    const res = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 100, subtotal: 999999 }],
      total: 999999, // deliberately inconsistent with qty(1) * unitPrice(100)
    })
    expect(res.status).toBe(201)

    const list = await request(app).get('/api/transactions')
    expect(list.body[0].total).toBe(100) // recomputed, not the client-supplied 999999
    expect(list.body[0].items[0].subtotal).toBe(100)
  })

  test('rejects an item with a non-numeric unitPrice instead of crashing', async () => {
    const res = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 1, unitPrice: 'abc', subtotal: 100 }],
      total: 100,
    })
    expect(res.status).toBe(400)
  })

  test('rejects an item with a zero or negative qty', async () => {
    const res = await request(app).post('/api/transactions').send({
      cashierId: 1,
      items: [{ productId: 1, productName: 'Test Product A', qty: 0, unitPrice: 100, subtotal: 0 }],
      total: 0,
    })
    expect(res.status).toBe(400)
  })
})
