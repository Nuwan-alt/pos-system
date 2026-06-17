require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes            = require('./routes/auth')
const cashierRoutes         = require('./routes/cashiers')
const productRoutes         = require('./routes/products')
const transactionRoutes     = require('./routes/transactions')
const deletionRequestRoutes = require('./routes/deletionRequests')
const settingsRoutes        = require('./routes/settings')
const dashboardRoutes       = require('./routes/dashboard')
const reportsRoutes         = require('./routes/reports')
const stockRoutes           = require('./routes/stock')

const app  = express()
const PORT = process.env.PORT || 5000

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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
