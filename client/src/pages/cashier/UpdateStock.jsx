import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PackagePlus, Search, User, Package, X, Plus, Minus, History } from 'lucide-react'
import { usePOS } from '../../context/POSContext'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'

export default function UpdateStock() {
  const navigate = useNavigate()
  const { products, cashiers, updateProductStock, refetchProducts, refetchCashiers } = usePOS()

  useEffect(() => { refetchProducts(); refetchCashiers() }, [])

  const [searchQuery,     setSearchQuery]     = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showDropdown,    setShowDropdown]    = useState(false)
  const [quantity,        setQuantity]        = useState('')
  const [selectedCashier, setSelectedCashier] = useState('')
  const [successMsg,      setSuccessMsg]      = useState('')
  const [errors,          setErrors]          = useState({})
  const [stockSearch,     setStockSearch]     = useState('')
  const [operation,       setOperation]       = useState('add')
  const [buyingRate,      setBuyingRate]      = useState('')

  const wrapperRef = useRef(null)

  const filteredProducts = searchQuery.trim()
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectProduct(product) {
    setSelectedProduct(product)
    setSearchQuery(product.name)
    setShowDropdown(false)
    setErrors(prev => ({ ...prev, product: undefined }))
  }

  function handleSearchChange(e) {
    setSearchQuery(e.target.value)
    setSelectedProduct(null)
    setShowDropdown(true)
    setErrors(prev => ({ ...prev, product: undefined }))
  }

  function validate() {
    const newErrors = {}
    const qty = parseInt(quantity, 10)
    if (!selectedProduct)              newErrors.product  = 'Please select a product'
    if (!quantity || qty <= 0)         newErrors.quantity = 'Please enter a valid quantity'
    if (!selectedCashier)              newErrors.cashier  = 'Please select a cashier'
    if (operation === 'remove' && selectedProduct && qty > selectedProduct.stock)
      newErrors.quantity = `Cannot remove ${qty} units. Only ${selectedProduct.stock} in stock.`
    if (operation === 'add') {
      const rate = parseFloat(buyingRate)
      if (buyingRate === '' || !Number.isFinite(rate) || rate < 0)
        newErrors.buyingRate = 'Please enter a valid buying price'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const qty = parseInt(quantity, 10)
    const signedQty = operation === 'add' ? qty : -qty
    const rate = parseFloat(buyingRate)
    try {
      await apiFetch('/api/stock/update', {
        method: 'POST',
        body: JSON.stringify({
          product_id:         selectedProduct.id,
          updated_by_id:      parseInt(selectedCashier, 10),
          updated_by_role:    'cashier',
          quantity_added:     signedQty,
          buyingPricePerUnit: operation === 'add' ? rate : undefined,
          note:               operation === 'add'
            ? `Cashier added ${qty} units`
            : `Cashier removed ${qty} units`,
        }),
      })
      updateProductStock(selectedProduct.id, signedQty)
      setSuccessMsg(operation === 'add'
        ? `✓ Added ${qty} units to ${selectedProduct.name}`
        : `✓ Removed ${qty} units from ${selectedProduct.name}`)
      setSearchQuery('')
      setSelectedProduct(null)
      setQuantity('')
      setBuyingRate('')
      setSelectedCashier('')
      setOperation('add')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setErrors(prev => ({ ...prev, submit: err.message }))
    }
  }

  const buyingRateNum = parseFloat(buyingRate)
  const buyingRateValid = Number.isFinite(buyingRateNum) && buyingRateNum >= 0
  const totalCost = buyingRateValid ? Math.round(parseInt(quantity, 10) * buyingRateNum * 100) / 100 : 0

  const isDisabled = !selectedProduct || !quantity || parseInt(quantity, 10) <= 0 ||
    !selectedCashier ||
    (operation === 'remove' && selectedProduct && parseInt(quantity, 10) > selectedProduct.stock) ||
    (operation === 'add' && !buyingRateValid)

  function stockColor(p) {
    if (p.stock === 0)                           return 'text-red-600'
    if (p.stock < p.minThreshold)                return 'text-amber-600'
    return 'text-green-600'
  }

  return (
    <div className="h-screen flex flex-col bg-white">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cashier/dashboard')}
              title="Back to Cashier"
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src={highlandLogo} alt="Highland Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Update Stock</h1>
              <p className="text-sm text-gray-500 mt-0.5">Add stock quantity to existing products</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/cashier/stock-history')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 transition-colors"
          >
            <History className="w-4 h-4" />
            Stock History
          </button>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-6 p-6">

        {/* ── LEFT — Form ─────────────────────────────────────────── */}
        <div className="w-[40%] shrink-0 overflow-y-auto">
          <div className="border border-gray-200 rounded-xl p-5">

            {/* Card header */}
            <div className="flex items-center gap-2 mb-1">
              <PackagePlus className="w-5 h-5 text-gray-700" />
              <h2 className="font-bold text-gray-900 text-base">Update Product Stock</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">Select a product and enter the quantity to add or remove</p>

            {/* Search & Select Product */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Search & Select Product
              </label>
              <div ref={wrapperRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Type to search products..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full bg-gray-100 rounded-lg pl-9 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
                {searchQuery && (
                  <button
                    onMouseDown={e => { e.preventDefault(); setSearchQuery(''); setSelectedProduct(null); setShowDropdown(false) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                )}
                {showDropdown && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No products found</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onMouseDown={() => selectProduct(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 text-left"
                        >
                          <span className="font-medium text-gray-900">{p.name}</span>
                          <span className="text-gray-400 text-xs ml-4 shrink-0">{p.stock} in stock</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <div className="mt-2 inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-medium">
                  ✓ Selected: {selectedProduct.name}
                </div>
              )}
              {errors.product && <p className="text-xs text-red-600 mt-1">{errors.product}</p>}
            </div>

            {/* Operation Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Operation</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setOperation('add')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    backgroundColor: operation === 'add' ? '#16a34a' : 'white',
                    color: operation === 'add' ? 'white' : '#6b7280',
                    border: operation === 'add' ? '1px solid #16a34a' : '1px solid #e5e7eb',
                  }}
                >
                  <Plus size={16} /> Add Stock
                </button>
                <button
                  onClick={() => setOperation('remove')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    backgroundColor: operation === 'remove' ? '#dc2626' : 'white',
                    color: operation === 'remove' ? 'white' : '#6b7280',
                    border: operation === 'remove' ? '1px solid #dc2626' : '1px solid #e5e7eb',
                  }}
                >
                  <Minus size={16} /> Remove Stock
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {operation === 'add' ? 'Quantity to Add' : 'Quantity to Remove'}
              </label>
              <input
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={quantity}
                onChange={e => { setQuantity(e.target.value); setErrors(prev => ({ ...prev, quantity: undefined })) }}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
              />
              {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
              {selectedProduct && quantity && parseInt(quantity, 10) > 0 && (
                <p style={{
                  marginTop: '6px', fontSize: '13px', fontWeight: '500',
                  color: operation === 'add'
                    ? '#16a34a'
                    : parseInt(quantity, 10) > selectedProduct.stock ? '#dc2626' : '#dc2626',
                }}>
                  {operation === 'add'
                    ? `New stock will be: ${selectedProduct.stock + parseInt(quantity, 10)} units`
                    : parseInt(quantity, 10) > selectedProduct.stock
                      ? `⚠ Cannot remove more than current stock (${selectedProduct.stock} units)`
                      : `New stock will be: ${selectedProduct.stock - parseInt(quantity, 10)} units`
                  }
                </p>
              )}
            </div>

            {/* Buying Price — only relevant when adding stock (a top-up is
                always a purchase in this shop's workflow) */}
            {operation === 'add' && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Buying Price per Unit (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={buyingRate}
                  onChange={e => { setBuyingRate(e.target.value); setErrors(prev => ({ ...prev, buyingRate: undefined })) }}
                  className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
                />
                {errors.buyingRate && <p className="text-xs text-red-600 mt-1">{errors.buyingRate}</p>}
                {buyingRateValid && quantity && parseInt(quantity, 10) > 0 && (
                  <p className="text-sm mt-1.5 font-bold text-gray-900">
                    Total Cost: Rs. {totalCost.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Select Cashier */}
            <div className="mb-5">
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1.5">
                <User className="w-4 h-4 text-gray-600" />
                Select Cashier
              </label>
              <select
                value={selectedCashier}
                onChange={e => { setSelectedCashier(e.target.value); setErrors(prev => ({ ...prev, cashier: undefined })) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-100 outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">-- Select Cashier --</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.cashier && <p className="text-xs text-red-600 mt-1">{errors.cashier}</p>}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '12px', borderRadius: '8px', border: 'none',
                color: 'white', fontWeight: '700', fontSize: '14px', cursor: isDisabled ? 'not-allowed' : 'pointer',
                backgroundColor: isDisabled ? '#9ca3af' : operation === 'add' ? '#111827' : '#dc2626',
                transition: 'background-color 0.2s ease',
              }}
            >
              {operation === 'add' ? <Plus size={16} /> : <Minus size={16} />}
              {operation === 'add' ? 'Add Stock' : 'Remove Stock'}
            </button>

            {/* Error / success message */}
            {errors.submit && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700">
                {errors.submit}
              </div>
            )}
            {successMsg && (
              <div className="mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                {successMsg}
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT — Current Stock Levels ────────────────────────── */}
        <div className="flex-1 min-w-0 border border-gray-200 rounded-xl flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100 shrink-0 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Package className="w-5 h-5 text-gray-700" />
                <h2 className="font-bold text-gray-900">Current Stock Levels</h2>
              </div>
              <p className="text-sm text-gray-500">Reference list of all products</p>
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter products..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                className="w-[220px] bg-gray-100 rounded-lg pl-9 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />
              {stockSearch && (
                <button
                  onClick={() => setStockSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Column headings */}
          <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-2 text-xs font-semibold text-gray-500 shrink-0 border-b border-gray-100">
            <span>Product Name</span>
            <span className="text-right">Stock</span>
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1">
            {(() => {
              const visible = stockSearch.trim()
                ? products.filter(p => p.name.toLowerCase().includes(stockSearch.toLowerCase()))
                : products
              if (visible.length === 0) return (
                <div className="flex items-center justify-center h-24">
                  <p className="text-sm text-gray-400">
                    {stockSearch.trim() ? 'No products match your search' : 'No products found'}
                  </p>
                </div>
              )
              return visible.map(p => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3 items-center border-b border-gray-50 text-sm"
                >
                  <span className="font-medium text-gray-900 truncate">{p.name}</span>
                  <span className={`font-bold text-right shrink-0 ${stockColor(p)}`}>
                    {p.stock} units
                  </span>
                </div>
              ))
            })()}
          </div>

        </div>
      </div>
    </div>
  )
}
