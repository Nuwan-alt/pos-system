const request = require('supertest')
const app = require('../server/app')
const { resetDb, closePool } = require('./helpers/db')

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await closePool()
})

describe('Settings API', () => {
  test('changes the admin password when the current password is correct', async () => {
    const res = await request(app).patch('/api/settings/password').send({
      role: 'admin', currentPassword: 'admin123', newPassword: 'newpass1',
    })
    expect(res.status).toBe(200)

    const login = await request(app).post('/api/auth/login').send({ role: 'admin', password: 'newpass1' })
    expect(login.status).toBe(200)

    const oldLogin = await request(app).post('/api/auth/login').send({ role: 'admin', password: 'admin123' })
    expect(oldLogin.status).toBe(401)
  })

  test('rejects the wrong current password', async () => {
    const res = await request(app).patch('/api/settings/password').send({
      role: 'admin', currentPassword: 'wrong', newPassword: 'newpass1',
    })
    expect(res.status).toBe(401)
  })

  test('rejects a new password shorter than 6 characters', async () => {
    const res = await request(app).patch('/api/settings/password').send({
      role: 'admin', currentPassword: 'admin123', newPassword: '123',
    })
    expect(res.status).toBe(400)
  })

  test('changing the cashier password does not affect the admin password', async () => {
    await request(app).patch('/api/settings/password').send({
      role: 'cashier', currentPassword: 'cashier123', newPassword: 'newcash1',
    })
    const adminLogin = await request(app).post('/api/auth/login').send({ role: 'admin', password: 'admin123' })
    expect(adminLogin.status).toBe(200)
  })

  test('reveals the current cashier password', async () => {
    const res = await request(app).get('/api/settings/password/cashier')
    expect(res.status).toBe(200)
    expect(res.body.password).toBe('cashier123')
  })

  test('reveal reflects a just-changed cashier password', async () => {
    await request(app).patch('/api/settings/password').send({
      role: 'cashier', currentPassword: 'cashier123', newPassword: 'newcash1',
    })
    const res = await request(app).get('/api/settings/password/cashier')
    expect(res.status).toBe(200)
    expect(res.body.password).toBe('newcash1')
  })
})
