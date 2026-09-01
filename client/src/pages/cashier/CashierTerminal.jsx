import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Receipt, Search, ShoppingCart, User, Trash2, PackagePlus, CreditCard, X, AlertCircle, Package } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch, apiUrl } from '../../lib/api'
import { getEffectivePrice } from '../../utils/pricing'
import highlandLogo from '../../images/highland.png'
import TransactionCompleteModal from '../../components/TransactionCompleteModal'
import { printBill } from '../../utils/printBill'

// Square product thumbnail with a graceful fallback: no image, a failed
// load, and "not scrolled into view yet" all render the same neutral
// placeholder — never a broken-image icon, and the box's size never changes,
// so cards don't shift as images load in. Sized at 64/80px (~1.45x the
// previous 44/56px) for at-a-glance recognizability. That growth ate
// directly into the text column's width budget, so the card's padding,
// the thumb-to-text gap, and the price row's font size were all re-tuned
// (and the stock pill got the same nowrap/flexShrink:0 treatment the price
// row already had) to keep every "must not wrap/overlap/change height"
// guarantee intact — re-verified against a 4-digit discounted price, a
// 4-digit stock count, and a long name, all at once.
//
// Lazy-loaded via IntersectionObserver, not just the native loading="lazy"
// attribute — with a ~150-product catalogue, native lazy-load heuristics
// alone aren't a hard enough guarantee that off-screen rows don't all fire
// at once. The observer only starts pointing a real <img> at the network
// once a card is actually near the viewport; only /image/thumb is ever
// requested here, never /image/full.
function ProductThumbnail({ product }) {
  const [imgError, setImgError] = useState(false)
  const [inView, setInView] = useState(false)
  const containerRef = useRef(null)
  const showImage = product.hasImage && inView && !imgError

  // If a product's image ever changes, give the new URL a fresh chance
  // instead of staying stuck on a stale failure.
  useEffect(() => { setImgError(false) }, [product.thumbnailUrl])

  useEffect(() => {
    if (!product.hasImage) return // nothing to fetch — skip the observer entirely
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // start the fetch a little before it's actually visible
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [product.id, product.hasImage])

  return (
    <div
      ref={containerRef}
      className="w-16 h-16 md:w-20 md:h-20"
      style={{
        flexShrink: 0,
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <img
          src={apiUrl(product.thumbnailUrl)}
          alt={product.name}
          width={80}
          height={80}
          loading="lazy"
          draggable={false}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      ) : (
        <div style={{ color: '#9ca3af', userSelect: 'none' }}>
          <Package size={26} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}

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
  const [amountGiven,     setAmountGiven]     = useState('')
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState(null)

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
  const hasZeroQtyIssue = cart.some(item => item.qty === 0)

  const change = amountGiven !== '' && parseFloat(amountGiven) >= total
    ? parseFloat(amountGiven) - total
    : null
  const isShortfall = amountGiven !== '' && parseFloat(amountGiven) < total

  const canComplete = cart.length > 0 && selectedCashier !== '' && !hasStockIssue && !isShortfall && !hasZeroQtyIssue

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

  const lowStockCount   = products.filter(p => p.stock > 0 && p.stock < p.minThreshold).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

  function addToCart(product) {
    if (product.stock === 0) return
    const effectivePrice = getEffectivePrice(product.price, product.discountAmount)
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

  // Barcode scan: add with qty 0 so the cashier must explicitly enter how many
  // units are being sold, instead of silently assuming 1 per scan.
  function addToCartByBarcode(product) {
    if (product.stock === 0) return
    const effectivePrice = getEffectivePrice(product.price, product.discountAmount)
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) return prev
      return [...prev, { ...product, price: effectivePrice, qty: 0 }]
    })
  }

  // +/- buttons and arrow keys: commit immediately, clear any pending typed value
  function adjustQty(id, newQty) {
    const clamped = Math.max(0, newQty)
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
    const final = (!isNaN(n) && n >= 0) ? n : currentQty
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: final } : item))
    setQtyInputs(prev => { const { [id]: _, ...rest } = prev; return rest })
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  async function completeTransaction() {
    if (completing) return
    if (hasZeroQtyIssue) {
      alert('One or more scanned items have a quantity of 0. Enter a quantity before completing the sale.')
      return
    }
    if (!canComplete) return
    setCompleting(true)
    try {
      const result = await apiFetch('/api/transactions', {
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
      // Refresh products so stock counts reflect the deduction (already applied server-side)
      const updated = await apiFetch('/api/products')
      setProducts(updated)

      // Amount Given is optional in this flow; treat a blank entry as exact payment (no change)
      const amountGivenNum = amountGiven !== '' ? parseFloat(amountGiven) : total

      setCompletedTransaction({
        transactionId: result.transactionRef,
        date:          new Date().toISOString().split('T')[0],
        time:          new Date().toLocaleTimeString('en-US'),
        cashierName:   cashiers.find(c => c.id === parseInt(selectedCashier))?.name || 'Unknown',
        // price is already the post-discount effective unit price (see
        // addToCart) — discount is passed separately as an informational
        // "amount saved per unit" for the receipt's DIS column, matching
        // printBill.js's non-recalculating template.
        cartItems:     cart.map(item => ({ name: item.name, quantity: item.qty, price: item.price, discount: item.discountAmount })),
        subtotal:      total,
        amountGiven:   amountGivenNum,
        change:        amountGivenNum - total,
      })
      setShowTransactionModal(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setCompleting(false)
    }
  }

  function handleCloseTransaction() {
    setCart([])
    setSelectedCashier('')
    setAmountGiven('')
    setShowTransactionModal(false)
    setCompletedTransaction(null)
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
        <div className="flex flex-col w-[55%] p-6 min-h-0">
          <h2 className="text-base font-bold text-gray-900 mb-4">Products</h2>

          {/* Search + filter row — same grid as product grid, so it always spans full width */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 shrink-0">
            <div className="col-span-2 md:col-span-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const match = products.find(p => p.barcode && p.barcode === search.trim())
                    if (match) {
                      addToCartByBarcode(match)
                      setSearch('')
                      e.preventDefault()
                    }
                  }}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto flex-1 content-start">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
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
                  padding: '12px',
                  cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
                  opacity: product.stock === 0 ? 0.85 : 1,
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* LEFT: text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name — clamped to 2 lines with a fixed-height block so every
                      card lines up regardless of name length; full text in the
                      title tooltip so nothing is lost to the ellipsis. */}
                  <p
                    title={product.name}
                    style={{
                      fontWeight: '700',
                      fontSize: '15px',
                      lineHeight: '1.3',
                      color: '#111827',
                      margin: 0,
                      height: '39px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.name}
                  </p>

                  {/* Discount badge row — always reserved at this height, empty
                      when there's no discount, so card height never depends on
                      whether a product has one. Lives here (not overlaid on the
                      thumbnail) because badge width is unbounded — a fixed-size
                      image can't safely contain "Rs. 1,200.00 OFF". */}
                  <div style={{ height: '20px', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                    {product.discountAmount > 0 && (
                      <span style={{ backgroundColor: '#dbeafe', color: '#3b82f6', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
                        Rs. {product.discountAmount.toFixed(2)} OFF
                      </span>
                    )}
                  </div>

                  {/* Price row — never wraps, even mid-value. Font sized down
                      (20px -> 17px -> 15px -> 13px) so a 4-digit price plus a
                      struck-through original still clears the thumbnail at
                      3-column width, re-verified at the larger 64/80px
                      thumbnail size — see ProductThumbnail's size note. */}
                  <div style={{ marginTop: '4px', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                    {product.discountAmount > 0 && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', textDecoration: 'line-through', marginRight: '3px', whiteSpace: 'nowrap' }}>
                        Rs. {product.price.toFixed(2)}
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>
                      Rs. {getEffectivePrice(product.price, product.discountAmount).toFixed(2)}
                    </span>
                  </div>

                  {/* Bottom row: stock badge. flexShrink:0 + whiteSpace:nowrap on
                      every variant — without them, a low/in-stock pill's text can
                      wrap onto 2 lines in the narrower text column this thumbnail
                      size leaves, growing that one card's height and (via CSS
                      Grid's default align-items:stretch) the whole row's height
                      with it. Same class of bug as the price row, same fix. */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                    {product.stock === 0 ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9999px', padding: '3px 7px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>Out of stock</span>
                      </div>
                    ) : product.stock < product.minThreshold ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '9999px', padding: '3px 7px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>{product.stock}</span>
                        <span style={{ fontSize: '11px', color: '#d97706' }}>— Low Stock</span>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, whiteSpace: 'nowrap', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '9999px', padding: '3px 7px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>{product.stock}</span>
                        <span style={{ fontSize: '11px', color: '#16a34a' }}>in stock</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: image thumbnail */}
                <ProductThumbnail product={product} />
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <p className="col-span-2 md:col-span-3 text-sm text-gray-400 text-center py-8">No products found.</p>
            )}
          </div>
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-gray-200 shrink-0" />

        {/* ── RIGHT PANEL — Current Sale ────────────────────────── */}
        <div className="flex flex-col w-[45%] p-6 min-h-0">

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
          <div style={{ flex: 1, overflowY: 'auto', minHeight: '250px', maxHeight: 'calc(100vh - 420px)', marginBottom: '16px' }}>
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-sm text-gray-400">No items in cart</p>
              </div>
            ) : (
              <div>
                {cart.map((item, index) => {
                  const overStock = item.qty > item.stock
                  const zeroQty = item.qty === 0
                  return (
                  <div key={item.id}>
                    <div className={`flex items-center gap-2 py-2.5 px-2 rounded-lg ${overStock || zeroQty ? 'bg-red-50' : ''}`}>

                      {/* Product name + unit price */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">Rs. {item.price.toFixed(2)} / unit</p>
                        {overStock && (
                          <p className="text-xs text-red-500 font-medium mt-0.5">
                            Only {item.stock} available
                          </p>
                        )}
                        {zeroQty && (
                          <p className="text-xs text-red-500 font-medium mt-0.5">
                            Enter a quantity
                          </p>
                        )}
                      </div>

                      {/* Quantity adjuster */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => adjustQty(item.id, item.qty - 1)}
                          disabled={item.qty <= 0}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-base leading-none font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={item.id in qtyInputs ? qtyInputs[item.id] : (item.qty === 0 ? '' : item.qty)}
                          placeholder="0"
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
          <div className="shrink-0 border-t border-gray-100 pt-3">

            {/* Select Cashier */}
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <User className="w-4 h-4 text-gray-600" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Select Cashier</span>
              </div>
              <select
                value={selectedCashier}
                onChange={e => setSelectedCashier(e.target.value)}
                className="w-full border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-gray-200"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <option value="">-- Select Cashier --</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '14px' }}>
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">Rs. {total.toFixed(2)}</span>
            </div>

            {/* Cash tendering */}
            {cart.length > 0 && (
              <>
                {/* Amount Given */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CreditCard size={14} color="#6b7280" />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>Amount Given</span>
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
                      padding: '7px 12px',
                      fontSize: '14px',
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
                  <div style={{ marginTop: '6px', padding: '7px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>
                    <AlertCircle size={14} />
                    Short by Rs. {(total - parseFloat(amountGiven)).toFixed(2)}
                  </div>
                )}

                {/* Change to return */}
                {change !== null && (
                  <div style={{ marginTop: '6px', padding: '7px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ fontWeight: '500', color: '#15803d' }}>Change to return</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#16a34a' }}>Rs. {change.toFixed(2)}</span>
                  </div>
                )}

                {/* Quick amount buttons */}
                {amountGiven === '' && total > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {getQuickAmounts(total).map(amount => (
                      <button
                        key={amount}
                        onClick={() => setAmountGiven(String(amount))}
                        style={{ padding: '3px 10px', fontSize: '11px', fontWeight: '600', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '9999px', cursor: 'pointer', color: '#374151' }}
                      >
                        Rs. {amount}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Zero-quantity warning */}
            {hasZeroQtyIssue && (
              <div style={{ marginTop: '6px', padding: '7px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>
                <AlertCircle size={14} />
                Enter a quantity for all scanned items before completing the sale
              </div>
            )}

            {/* Complete Transaction button */}
            <button
              onClick={completeTransaction}
              disabled={!canComplete || completing}
              style={{ marginTop: '8px', padding: '11px' }}
              className={`w-full rounded-lg text-white font-bold text-sm transition-colors ${
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

      {showTransactionModal && completedTransaction && (
        <TransactionCompleteModal
          {...completedTransaction}
          onPrintBill={() => { printBill(completedTransaction); handleCloseTransaction() }}
          onSkip={handleCloseTransaction}
          onClose={handleCloseTransaction}
        />
      )}
    </div>
  )
}
