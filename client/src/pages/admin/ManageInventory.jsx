import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Search, Trash2, Lock, X, PackagePlus } from 'lucide-react'
import { apiFetch } from '../../lib/api'

const EMPTY_FORM = { name: '', price: '', discount: '0', minThreshold: '' }

export default function ManageInventory() {
  const navigate = useNavigate()
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [editingId,   setEditingId]   = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [formError,   setFormError]   = useState('')
  const [successMsg,  setSuccessMsg]  = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [deleteModal,  setDeleteModal]  = useState({ open: false, productId: null, productName: '' })
  const [password,     setPassword]     = useState('')
  const [pwError,      setPwError]      = useState('')
  const [stockModal,   setStockModal]   = useState({ open: false, product: null })
  const [stockOp,      setStockOp]      = useState('add')
  const [stockQty,     setStockQty]     = useState('')
  const [stockNote,    setStockNote]    = useState('')
  const [stockErr,     setStockErr]     = useState('')
  const [stockBusy,    setStockBusy]    = useState(false)
  const [stockSuccess, setStockSuccess] = useState(null)

  function fetchProducts() {
    apiFetch('/api/products')
      .then(data => setProducts(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProducts()
    window.addEventListener('focus', fetchProducts)
    return () => window.removeEventListener('focus', fetchProducts)
  }, [])

  const totalStock    = useMemo(() => products.reduce((s, p) => s + p.stock, 0), [products])
  const lowStockCount = useMemo(() => products.filter(p => p.stock < p.minThreshold).length, [products])

  const filtered = useMemo(() => {
    let rows = stockFilter === 'low' ? products.filter(p => p.stock < p.minThreshold) : products
    if (searchQuery.trim())
      rows = rows.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return rows
  }, [products, searchQuery, stockFilter])

  function patch(fields) { setForm(prev => ({ ...prev, ...fields })); setFormError('') }

  function finalPrice() {
    const p = parseFloat(form.price) || 0
    const d = parseFloat(form.discount) || 0
    return (p * (1 - d / 100)).toFixed(2)
  }

  function validate() {
    if (!form.name.trim())                                             { setFormError('Product name is required.'); return false }
    if (isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0) { setFormError('Price must be greater than 0.'); return false }
    if (parseFloat(form.minThreshold) < 0 || isNaN(parseFloat(form.minThreshold))) { setFormError('Threshold cannot be negative.'); return false }
    return true
  }

  function buildPayload() {
    return {
      name:         form.name.trim(),
      price:        parseFloat(form.price),
      discount:     parseFloat(form.discount) || 0,
      minThreshold: parseInt(form.minThreshold, 10) || 0,
    }
  }

  async function handleAdd() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const created = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      })
      setProducts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(EMPTY_FORM)
      setSuccessMsg('Product added successfully!')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate() {
    if (!validate()) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/products/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload()),
      })
      setProducts(prev =>
        prev.map(p => p.id === editingId ? { ...p, ...buildPayload() } : p)
            .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(product) {
    setEditingId(product.id)
    setForm({
      name:         product.name,
      price:        String(product.price),
      discount:     String(product.discount),
      minThreshold: String(product.minThreshold),
    })
    setFormError('')
    setSuccessMsg('')
  }

  function openStockModal(product) {
    setStockModal({ open: true, product })
    setStockOp('add')
    setStockQty('')
    setStockNote('')
    setStockErr('')
  }

  function closeStockModal() {
    setStockModal({ open: false, product: null })
    setStockErr('')
    setStockBusy(false)
  }

  async function handleStockAdjust() {
    const qty = parseInt(stockQty, 10)
    if (!qty || qty <= 0) return
    if (stockOp === 'remove' && qty > stockModal.product.stock) return
    setStockBusy(true)
    setStockErr('')
    try {
      const result = await apiFetch('/api/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: stockModal.product.id,
          operation:  stockOp,
          quantity:   qty,
          note:       stockNote.trim() || null,
        }),
      })
      setProducts(prev =>
        prev.map(p => p.id === stockModal.product.id ? { ...p, stock: result.new_stock } : p)
      )
      setStockSuccess(stockModal.product.id)
      setTimeout(() => setStockSuccess(null), 2000)
      closeStockModal()
    } catch (err) {
      setStockErr(err.message)
    } finally {
      setStockBusy(false)
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openDelete(product) {
    setDeleteModal({ open: true, productId: product.id, productName: product.name })
    setPassword('')
    setPwError('')
  }

  function closeDelete() {
    setDeleteModal({ open: false, productId: null, productName: '' })
    setPassword('')
    setPwError('')
  }

  async function handleDelete() {
    setSubmitting(true)
    try {
      await apiFetch(`/api/products/${deleteModal.productId}`, {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword: password }),
      })
      setProducts(prev => prev.filter(p => p.id !== deleteModal.productId))
      closeDelete()
    } catch (err) {
      setPwError(err.message === 'Incorrect admin password.' ? 'Incorrect password. Try again.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewQty   = parseInt(stockQty, 10) || 0
  const currentStk   = stockModal.product?.stock ?? 0
  const previewStock = stockOp === 'add' ? currentStk + previewQty : currentStk - previewQty
  const isOverRemove = stockOp === 'remove' && previewQty > currentStk
  const canConfirm   = previewQty > 0 && !isOverRemove && !stockBusy

  return (
    <div className="h-screen flex flex-col bg-white">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} title="Back to Dashboard"
            className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
            <p className="text-sm text-gray-500 mt-0.5">Add and manage inventory items</p>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-6 p-6">

        {/* ── LEFT — Add / Edit form ───────────────────────────── */}
        <div className="w-[32%] shrink-0 overflow-y-auto">
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              {editingId ? <Pencil className="w-5 h-5 text-gray-700" /> : <Plus className="w-5 h-5 text-gray-700" />}
              <h2 className="font-bold text-gray-900">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input type="text" placeholder="Enter product name" value={form.name}
                onChange={e => patch({ name: e.target.value })}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (Rs.)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price}
                onChange={e => patch({ price: e.target.value })}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
              <input type="number" min="0" max="100" placeholder="0" value={form.discount}
                onChange={e => patch({ discount: e.target.value })}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner" />
              <p className="text-xs text-gray-400 mt-1">Final Price: Rs. {finalPrice()}</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Threshold</label>
              <input type="number" min="0" placeholder="0" value={form.minThreshold}
                onChange={e => patch({ minThreshold: e.target.value })}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner" />
              <p className="text-xs text-gray-400 mt-1">Items below this quantity will be flagged as low stock</p>
            </div>

            {formError && <p className="text-red-500 text-xs mb-3">{formError}</p>}

            {editingId ? (
              <div className="flex gap-2">
                <button onClick={handleUpdate} disabled={submitting}
                  className="flex-[7] bg-gray-900 text-white font-bold py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm">
                  {submitting ? 'Saving…' : 'Update Product'}
                </button>
                <button onClick={cancelEdit}
                  className="flex-[3] border border-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={handleAdd} disabled={submitting}
                className="w-full bg-gray-900 text-white font-bold py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm">
                {submitting ? 'Adding…' : 'Add Product'}
              </button>
            )}

            {successMsg && <p className="text-green-600 text-xs mt-3 text-center">{successMsg}</p>}
          </div>
        </div>

        {/* ── RIGHT — Stats + Table ────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5 overflow-hidden">

          <div className="flex gap-4 shrink-0">
            <button onClick={() => setStockFilter('all')}
              className={`flex-1 rounded-xl p-4 flex flex-col items-center text-center border transition-colors cursor-pointer ${
                stockFilter === 'all' ? 'bg-[#bfdbfe] border-[#93c5fd]' : 'bg-[#eff6ff] border-[#bfdbfe] hover:bg-[#dbeafe]'
              }`}>
              <p className="text-xs text-gray-500 mb-1">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            </button>

            <div className="flex-1 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex flex-col items-center text-center">
              <p className="text-xs text-gray-500 mb-1">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">{totalStock.toLocaleString()} items</p>
            </div>

            <button onClick={() => setStockFilter('low')}
              className={`flex-1 rounded-xl p-4 flex flex-col items-center text-center border transition-colors cursor-pointer ${
                stockFilter === 'low' ? 'bg-[#fde68a] border-[#f59e0b]' : 'bg-[#fefce8] border-[#fde68a] hover:bg-[#fef08a]'
              }`}>
              <p className="text-xs text-gray-500 mb-1">Low Stock</p>
              <p className="text-2xl font-bold text-red-600">{lowStockCount} items</p>
            </button>
          </div>

          <div className="flex-1 min-h-0 border border-gray-200 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Product Inventory</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" placeholder="Search products..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 w-48" />
              </div>
            </div>

            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-3 px-5 py-2 text-xs font-semibold text-gray-500 shrink-0 border-b border-gray-100">
              <span>Product Name</span>
              <span>Price</span>
              <span>Discount</span>
              <span>Final Price</span>
              <span>Stock</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-sm text-gray-400">No products found</p>
                </div>
              ) : (
                filtered.map(product => {
                  const isLow     = product.stock < product.minThreshold
                  const isEditing = editingId === product.id
                  const fp        = (product.price * (1 - product.discount / 100)).toFixed(2)
                  return (
                    <div key={product.id}
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-3 px-5 py-3 items-center border-b border-gray-50 text-sm ${
                        isEditing ? 'bg-gray-100' : isLow ? 'bg-[#fff5f5]' : 'bg-white'
                      }`}>
                      <span className="font-semibold text-gray-900 truncate">{product.name}</span>
                      <span className="text-gray-600">Rs. {product.price.toFixed(2)}</span>
                      <span className="text-gray-600">{product.discount}%</span>
                      <span className="font-bold text-gray-900">Rs. {fp}</span>
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-600'}`}>
                        {product.stock} units
                        {stockSuccess === product.id && (
                          <span className="ml-1.5 text-green-600 text-xs font-bold">✓</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => openStockModal(product)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-green-600 hover:border-green-600 hover:text-white transition-colors"
                          title="Update stock">
                          <PackagePlus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => startEdit(product)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isEditing
                              ? 'bg-gray-900 border-gray-900 text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-blue-700 hover:border-blue-700 hover:text-white'
                          }`}
                          title="Edit product">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openDelete(product)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
                          title="Delete product">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STOCK UPDATE MODAL ───────────────────────────────────── */}
      {stockModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-[420px] p-6">

            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <PackagePlus className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Update Stock</p>
                  <p className="text-sm text-gray-500">{stockModal.product?.name}</p>
                </div>
              </div>
              <button onClick={closeStockModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-5">
              <span className="text-sm text-gray-600">Current Stock</span>
              <span className="font-bold text-gray-900">{stockModal.product?.stock} units</span>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setStockOp('add')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  stockOp === 'add'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Add Stock
              </button>
              <button
                onClick={() => setStockOp('remove')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  stockOp === 'remove'
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Remove Stock
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {stockOp === 'add' ? 'Quantity to Add' : 'Quantity to Remove'}
              </label>
              <input
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={stockQty}
                onChange={e => setStockQty(e.target.value)}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
              />
              {previewQty > 0 && (
                isOverRemove ? (
                  <p className="text-xs text-red-600 mt-1.5 font-medium">
                    Cannot remove more than current stock ({currentStk} units)
                  </p>
                ) : (
                  <p className={`text-xs mt-1.5 font-medium ${stockOp === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                    New stock will be: {previewStock} units
                  </p>
                )
              )}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Received new delivery"
                value={stockNote}
                onChange={e => setStockNote(e.target.value)}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            {stockErr && <p className="text-red-500 text-xs mb-3">{stockErr}</p>}

            <div className="flex gap-3">
              <button
                onClick={closeStockModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={!canConfirm}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  stockOp === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {stockBusy ? 'Updating…' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────────── */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-bold text-gray-900">Confirm Delete</span>
              </div>
              <button onClick={closeDelete} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-1">You are about to delete:</p>
            <p className="font-bold text-gray-900 mb-5">{deleteModal.productName}</p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Enter Admin Password</label>
            <input type="password" placeholder="Admin password" value={password}
              onChange={e => { setPassword(e.target.value); setPwError('') }}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300" />
            {pwError && <p className="text-red-500 text-xs mt-1">{pwError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={closeDelete}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Deleting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
