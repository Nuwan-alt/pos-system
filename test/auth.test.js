const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Auth API', () => {
  test('admin logs in with the correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, role: 'admin' })
  })

  test('cashier logs in with the correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'cashier', password: 'cashier123' })
    expect(res.status).toBe(200)
  })

  test('rejects the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  test('rejects an invalid role', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'superadmin', password: 'x' })
    expect(res.status).toBe(400)
  })

  test('rejects a missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin' })
    expect(res.status).toBe(400)
  })
})
