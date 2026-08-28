const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const authRoutes            = require('./routes/auth')
const cashierRoutes         = require('./routes/cashiers')
const productRoutes         = require('./routes/products')
const transactionRoutes     = require('./routes/transactions')
const deletionRequestRoutes = require('./routes/deletionRequests')
const settingsRoutes        = require('./routes/settings')
const dashboardRoutes       = require('./routes/dashboard')
const reportsRoutes         = require('./routes/reports')
const stockRoutes           = require('./routes/stock')
const drawerRoutes          = require('./routes/drawer')

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/auth',              authRoutes)
app.use('/api/cashiers',          cashierRoutes)
app.use('/api/products',          productRoutes)
app.use('/api/transactions',      transactionRoutes)
app.use('/api/deletion-requests', deletionRequestRoutes)
app.use('/api/settings',          settingsRoutes)
app.use('/api/dashboard',         dashboardRoutes)
app.use('/api/reports',           reportsRoutes)
app.use('/api/stock',             stockRoutes)
app.use('/api/drawer',           drawerRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

module.exports = app
