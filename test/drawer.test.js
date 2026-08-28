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

  test('closing the drawer computes the correct difference from opening amount', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    await request(app).post('/api/drawer/close').send({
      closing_amount: 1500, closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })

    const history = await request(app).get('/api/drawer/history')
    expect(history.body.data[0].difference).toBe(500)
  })

  test('closing requires an already-open drawer for today', async () => {
    const res = await request(app).post('/api/drawer/close').send({
      closing_amount: 100, closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(400)
  })

  test("reset requires the correct admin password and removes today's record", async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const bad = await request(app).post('/api/drawer/reset').send({ adminPassword: 'wrong' })
    expect(bad.status).toBe(403)

    const ok = await request(app).post('/api/drawer/reset').send({ adminPassword: 'admin123' })
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

  test('FIXED: a non-numeric closing amount is rejected with a 400, not a 500', async () => {
    await request(app).post('/api/drawer/open').send({
      opening_amount: 1000, opened_by_role: 'admin', opened_by_id: 1, opened_by_name: 'Admin',
    })
    const res = await request(app).post('/api/drawer/close').send({
      closing_amount: 'abc', closed_by_role: 'admin', closed_by_id: 1, closed_by_name: 'Admin',
    })
    expect(res.status).toBe(400)
  })
})
