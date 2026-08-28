const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Cashiers API', () => {
  test('GET /api/cashiers/active only returns active cashiers', async () => {
    const res = await request(app).get('/api/cashiers/active')
    expect(res.body).toEqual([{ id: 1, name: 'Active Cashier' }])
  })

  test('POST /api/cashiers rejects an invalid NIC', async () => {
    const res = await request(app).post('/api/cashiers').send({
      name: 'X', nic: '123', mobile: '0771234567',
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/cashiers rejects an invalid mobile number', async () => {
    const res = await request(app).post('/api/cashiers').send({
      name: 'X', nic: '200012345678', mobile: '123',
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/cashiers rejects a duplicate NIC', async () => {
    const res = await request(app).post('/api/cashiers').send({
      name: 'Dup', nic: '200012345678', mobile: '0709999999',
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/cashiers rejects a duplicate mobile number', async () => {
    const res = await request(app).post('/api/cashiers').send({
      name: 'Dup', nic: '981234567V', mobile: '0771234567',
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/cashiers creates a new cashier as disabled by default', async () => {
    const res = await request(app).post('/api/cashiers').send({
      name: 'New Cashier', nic: '981234567V', mobile: '0709999999',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('disabled')
  })

  test('PATCH /api/cashiers/:id/status requires an admin password', async () => {
    const res = await request(app).patch('/api/cashiers/1/status').send({ status: 'disabled' })
    expect(res.status).toBe(400)
  })

  test('PATCH /api/cashiers/:id/status toggles status with the correct password', async () => {
    const res = await request(app).patch('/api/cashiers/1/status').send({
      status: 'disabled', adminPassword: 'admin123',
    })
    expect(res.status).toBe(200)

    const active = await request(app).get('/api/cashiers/active')
    expect(active.body).toEqual([])
  })

  test('DELETE /api/cashiers/:id requires the correct admin password', async () => {
    const bad = await request(app).delete('/api/cashiers/1').send({ adminPassword: 'wrong' })
    expect(bad.status).toBe(403)

    const ok = await request(app).delete('/api/cashiers/1').send({ adminPassword: 'admin123' })
    expect(ok.status).toBe(200)

    const all = await request(app).get('/api/cashiers')
    expect(all.body.find(c => c.id === 1)).toBeUndefined()
  })
})
