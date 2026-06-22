import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Receipt, Search, ShoppingCart, User, Trash2, PackagePlus, CreditCard, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'

export default function CashierTerminal() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [products,        setProducts]        = useState([])
  const [cashiers,        setCashiers]        = useState([])
  const [cart,            setCart]            = useState([])
  const [search,          setSearch]          = useState('')
  const [stockFilter,     setStockFilter]     = useState('all') // 'all' | 'low' | 'out'
  const [selectedCashier, setSelectedCashier] = useState('')
  const [qtyInputs,       setQtyInputs]       = useState({})
  const [completing,      setCompleting]      = useState(false)
  const [successMsg,      setSuccessMsg]      = useState('')
  const [amountGiven,     setAmountGiven]     = useState('')

  function refetchAll() {
    apiFetch('/api/products').then(setProducts).catch(() => {})
    apiFetch('/api/cashiers/active').then(setCashiers).catch(() => {})
  }

  useEffect(() => {
    refetchAll()
    window.addEventListener('focus', refetchAll)
    return () => window.removeEventListener('focus', refetchAll)
  }, [])

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => {
      if (stockFilter === 'low') return p.stock > 0 && p.stock < p.minThreshold
      if (stockFilter === 'out') return p.stock === 0
      return true
    })

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const hasStockIssue = cart.some(item => item.qty > item.stock)

  const change = amountGiven !== '' && parseFloat(amountGiven) >= total
    ? parseFloat(amountGiven) - total
    : null
  const isShortfall = amountGiven !== '' && parseFloat(amountGiven) < total

  const canComplete = cart.length > 0 && selectedCashier !== '' && !hasStockIssue && !isShortfall

  function getQuickAmounts(cartTotal) {
    const amounts = []
    const roundedUp = Math.ceil(cartTotal / 10) * 10
    if (roundedUp !== cartTotal) amounts.push(roundedUp)
    const hundreds = Math.ceil(cartTotal / 100) * 100
    if (!amounts.includes(hundreds)) amounts.push(hundreds)
    const twoHundreds = hundreds + 100
    amounts.push(twoHundreds)
    const fiveHundreds = Math.ceil(cartTotal / 500) * 500
    if (!amounts.includes(fiveHundreds)) amounts.push(fiveHundreds)
    if (!amounts.includes(1000)) amounts.push(1000)
    return [...new Set(amounts)].sort((a, b) => a - b).slice(0, 4)
  }

  const lowStockCount   = products.filter(p => p.stock > 0 && p.stock <= p.minThreshold).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

  function addToCart(product) {
    if (product.stock === 0) return
    const effectivePrice = product.discount
      ? parseFloat((product.price * (1 - product.discount / 100)).toFixed(2))
      : product.price
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [...prev, { ...product, price: effectivePrice, qty: 1 }]
    })
  }

  // +/- buttons and arrow keys: commit immediately, clear any pending typed value
  function adjustQty(id, newQty) {
    const clamped = Math.max(1, newQty)
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: clamped } : item))
    setQtyInputs(prev => { const { [id]: _, ...rest } = prev; return rest })
  }

  // Direct typing: just update the display string, don't touch the cart yet
  function handleQtyInput(id, raw) {
    setQtyInputs(prev => ({ ...prev, [id]: raw }))
  }

  // On blur/Enter: validate and commit; revert to current cart qty if invalid
  function commitQtyInput(id, currentQty) {
    const raw = qtyInputs[id]
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    const final = (!isNaN(n) && n >= 1) ? n : currentQty
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: final } : item))
    setQtyInputs(prev => { const { [id]: _, ...rest } = prev; return rest })
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  async function completeTransaction() {
    if (!canComplete || completing) return
    setCompleting(true)
    try {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          cashierId: parseInt(selectedCashier),
          total,
          items: cart.map(item => ({
            productId:   item.id,
            productName: item.name,
            qty:         item.qty,
            unitPrice:   item.price,
            subtotal:    parseFloat((item.price * item.qty).toFixed(2)),
          })),
        }),
      })
      // Refresh products so stock counts reflect the deduction
      const updated = await apiFetch('/api/products')
      setProducts(updated)
      setCart([])
      setSelectedCashier('')
      setAmountGiven('')
      setSuccessMsg('Transaction completed!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      alert(err.message)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={highlandLogo}
            alt="Highland Logo"
            style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '50%' }}
          />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>Cashier Terminal</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Highland Kottawa POS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/cashier/drawer')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Cash Drawer
          </button>
          <button
            onClick={() => navigate('/cashier/update-stock')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            Update Stock
          </button>
          <button
            onClick={() => navigate('/cashier/transactions')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            Transactions
          </button>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL — Products ─────────────────────────────── */}
        <div className="flex flex-col w-[65%] p-6 min-h-0">
          <h2 className="text-base font-bold text-gray-900 mb-4">Products</h2>

          {/* Search + filter row — same grid as product grid; col-span-2 = exactly 2 cards + 1 gap */}
          <div className="grid grid-cols-3 gap-4 mb-4 shrink-0">
            <div className="col-span-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-100 rounded-full pl-10 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  onClick={() => setStockFilter(f => f === 'low' ? 'all' : 'low')}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    stockFilter === 'low'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-orange-500 border-orange-500 hover:bg-orange-50'
                  }`}
                >
                  Low Stock
                </button>
                {lowStockCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-8px', right: '-8px',
                    backgroundColor: '#f97316', color: 'white',
                    borderRadius: '9999px', minWidth: '20px', height: '20px',
                    fontSize: '11px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', pointerEvents: 'none',
                  }}>
                    {lowStockCount}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  onClick={() => setStockFilter(f => f === 'out' ? 'all' : 'out')}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    stockFilter === 'out'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-red-500 border-red-500 hover:bg-red-50'
                  }`}
                >
                  Out of Stock
                </button>
                {outOfStockCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-8px', right: '-8px',
                    backgroundColor: '#ef4444', color: 'white',
                    borderRadius: '9999px', minWidth: '20px', height: '20px',
                    fontSize: '11px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', pointerEvents: 'none',
                  }}>
                    {outOfStockCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Product grid — scrollable */}
          <div className="grid grid-cols-4 gap-4 overflow-y-auto flex-1 content-start">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                style={{
                  border: product.stock === 0 ? '1px solid #fecaca' : '1px solid #e5e7eb',
                  borderTop: `2px solid ${
                    product.stock === 0
                      ? '#ef4444'
                      : product.stock < product.minThreshold
                        ? '#f59e0b'
                        : '#22c55e'
                  }`,
                  borderRadius: '12px',
                  backgroundColor: product.stock === 0 ? '#fff5f5' : 'white',
                  padding: '14px',
                  cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
                  opacity: product.stock === 0 ? 0.85 : 1,
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Top row: name + discount badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>{product.name}</span>
                  {product.discount > 0 && (
                    <span style={{ backgroundColor: '#dbeafe', color: '#3b82f6', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '9999px', flexShrink: 0, marginLeft: '6px' }}>
                      {product.discount}% OFF
                    </span>
                  )}
                </div>

                {/* Price row */}
                <div style={{ marginBottom: '4px' }}>
                  {product.discount > 0 && (
                    <span style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'line-through', marginRight: '6px' }}>
                      Rs. {product.price.toFixed(2)}
                    </span>
                  )}
                  <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                    Rs. {product.discount
                      ? (product.price * (1 - product.discount / 100)).toFixed(2)
                      : product.price.toFixed(2)}
                  </span>
                </div>

                {/* Bottom row: stock badge right-aligned */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                  {product.stock === 0 ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9999px', padding: '3px 10px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>Out of stock</span>
                    </div>
                  ) : product.stock < product.minThreshold ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '9999px', padding: '3px 10px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>{product.stock}</span>
                      <span style={{ fontSize: '12px', color: '#d97706' }}>— Low Stock</span>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '9999px', padding: '3px 10px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>{product.stock}</span>
                      <span style={{ fontSize: '12px', color: '#16a34a' }}>in stock</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <p className="col-span-3 text-sm text-gray-400 text-center py-8">No products found.</p>
            )}
          </div>
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-gray-200 shrink-0" />

        {/* ── RIGHT PANEL — Current Sale ────────────────────────── */}
        <div className="flex flex-col w-[35%] p-6 min-h-0">

          {/* Panel title */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              <h2 className="text-base font-bold text-gray-900">Current Sale</h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Clear all items from the cart?')) {
                    setCart([])
                    setSelectedCashier('')
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 border border-red-400 hover:border-red-600 bg-red-50 hover:bg-red-100 font-medium px-3 py-1 rounded-lg transition-colors"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 mb-4">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-sm text-gray-400">No items in cart</p>
              </div>
            ) : (
              <div>
                {cart.map((item, index) => {
                  const overStock = item.qty > item.stock
                  return (
                  <div key={item.id}>
                    <div className={`flex items-center gap-2 py-2.5 px-2 rounded-lg ${overStock ? 'bg-red-50' : ''}`}>

                      {/* Product name + unit price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">Rs. {item.price.toFixed(2)} / unit</p>
                        {overStock && (
                          <p className="text-xs text-red-500 font-medium mt-0.5">
                            Only {item.stock} available
                          </p>
                        )}
                      </div>

                      {/* Quantity adjuster */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => adjustQty(item.id, item.qty - 1)}
                          disabled={item.qty <= 1}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-base leading-none font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.id in qtyInputs ? qtyInputs[item.id] : item.qty}
                          onChange={e => handleQtyInput(item.id, e.target.value)}
                          onBlur={() => commitQtyInput(item.id, item.qty)}
                          onKeyDown={e => {
                            if (e.key === 'ArrowUp')   { e.preventDefault(); adjustQty(item.id, item.qty + 1) }
                            if (e.key === 'ArrowDown') { e.preventDefault(); adjustQty(item.id, item.qty - 1) }
                            if (e.key === 'Enter')     { e.target.blur() }
                          }}
                          className="w-10 text-center text-sm border border-gray-200 rounded py-0.5 outline-none focus:ring-1 focus:ring-gray-300 no-spinner"
                        />
                        <button
                          onClick={() => adjustQty(item.id, item.qty + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-base leading-none font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <p className="text-sm font-bold text-gray-900 text-right shrink-0 whitespace-nowrap w-24">
                        Rs. {(item.price * item.qty).toFixed(2)}
                      </p>

                      {/* Delete */}
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {index < cart.length - 1 && (
                      <hr className="border-gray-100" />
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Bottom section (never scrolls away) ─────────────── */}
          <div className="shrink-0 border-t border-gray-100 pt-4 space-y-4">

            {/* Select Cashier */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-bold text-gray-900">Select Cashier</span>
              </div>
              <select
                value={selectedCashier}
                onChange={e => setSelectedCashier(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">-- Select Cashier --</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">Rs. {total.toFixed(2)}</span>
            </div>

            {/* Cash tendering */}
            {cart.length > 0 && (
              <>
                {/* Amount Given */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <CreditCard size={15} color="#6b7280" />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Amount Given</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountGiven}
                    onChange={e => setAmountGiven(e.target.value)}
                    placeholder="Enter amount..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '16px',
                      fontWeight: '500',
                      backgroundColor: '#f3f4f6',
                      border: isShortfall ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                      borderRadius: '10px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#111827',
                    }}
                  />
                </div>

                {/* Shortfall warning */}
                {isShortfall && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>
                    <AlertCircle size={14} />
                    Short by Rs. {(total - parseFloat(amountGiven)).toFixed(2)}
                  </div>
                )}

                {/* Change to return */}
                {change !== null && (
                  <div style={{ marginTop: '8px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#15803d' }}>Change to return</span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>Rs. {change.toFixed(2)}</span>
                  </div>
                )}

                {/* Quick amount buttons */}
                {amountGiven === '' && total > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {getQuickAmounts(total).map(amount => (
                      <button
                        key={amount}
                        onClick={() => setAmountGiven(String(amount))}
                        style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '9999px', cursor: 'pointer', color: '#374151' }}
                      >
                        Rs. {amount}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Success banner */}
            {successMsg && (
              <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 text-center">
                {successMsg}
              </div>
            )}

            {/* Complete Transaction button */}
            <button
              onClick={completeTransaction}
              disabled={!canComplete || completing}
              className={`w-full py-3 rounded-lg text-white font-bold text-sm transition-colors ${
                canComplete && !completing
                  ? 'bg-gray-900 hover:bg-gray-800 cursor-pointer'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {completing ? 'Processing…' : 'Complete Transaction'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
