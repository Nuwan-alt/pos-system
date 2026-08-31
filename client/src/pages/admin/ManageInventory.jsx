import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Search, Trash2, Lock, X, PackagePlus, Image as ImageIcon, Package, Barcode } from 'lucide-react'
import { apiFetch, apiUrl } from '../../lib/api'
import { getEffectivePrice } from '../../utils/pricing'
import { generateMimicBarcode } from '../../utils/barcode'
import PasswordInput from '../../components/PasswordInput'

const EMPTY_FORM = { name: '', price: '', discountAmount: '0', minThreshold: '', barcode: '' }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Mirrors the server's rules (server/utils/imageProcessing.js) so the admin
// sees the same error inline instead of waiting on a round-trip — the
// server still re-validates by content, this is just a fast first pass.
function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are allowed.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be 5MB or smaller.'
  }
  return null
}

// Small thumbnail for the inventory table — same graceful-fallback pattern
// as the cashier card's ProductThumbnail, sized for a compact table row.
function InventoryThumbnail({ product }) {
  const [imgError, setImgError] = useState(false)
  const showImage = product.hasImage && !imgError

  useEffect(() => { setImgError(false) }, [product.thumbnailUrl])

  return (
    <div style={{
      width: '32px', height: '32px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden',
      backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {showImage ? (
        <img
          src={apiUrl(product.thumbnailUrl)}
          alt={product.name}
          width={32}
          height={32}
          loading="lazy"
          draggable={false}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
        />
      ) : (
        <Package size={14} strokeWidth={1.5} color="#9ca3af" />
      )}
    </div>
  )
}

export default function ManageInventory() {
  const navigate = useNavigate()
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
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
  const [stockRate,    setStockRate]    = useState('')
  const [stockNote,    setStockNote]    = useState('')
  const [stockErr,     setStockErr]     = useState('')
  const [stockBusy,    setStockBusy]    = useState(false)
  const [stockSuccess, setStockSuccess] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null) // full product being edited, for its current image
  const [imageFile,      setImageFile]      = useState(null) // newly-selected File (add or replace)
  const [imagePreview,   setImagePreview]   = useState(null) // object URL for imageFile
  const [imageError,     setImageError]     = useState('')
  const [removeImage,    setRemoveImage]    = useState(false) // edit-mode: user asked to clear the image

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function fetchProducts() {
    setLoadError('')
    Promise.all([apiFetch('/api/products'), apiFetch('/api/products/costs')])
      .then(([products, costs]) => {
        const costById = new Map(costs.map(c => [c.productId, c.currentCost]))
        setProducts(products.map(p => ({ ...p, currentCost: costById.get(p.id) ?? null })))
      })
      .catch(err => setLoadError(err.message || 'Failed to load products.'))
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
    const d = parseFloat(form.discountAmount) || 0
    return getEffectivePrice(p, d).toFixed(2)
  }

  function validate() {
    const price = parseFloat(form.price)
    const discountAmount = parseFloat(form.discountAmount) || 0
    if (!form.name.trim())                                             { setFormError('Product name is required.'); return false }
    if (isNaN(price) || price <= 0)                                    { setFormError('Price must be greater than 0.'); return false }
    if (parseFloat(form.minThreshold) < 0 || isNaN(parseFloat(form.minThreshold))) { setFormError('Threshold cannot be negative.'); return false }
    if (isNaN(discountAmount) || discountAmount < 0)                   { setFormError('Discount amount must be 0 or greater.'); return false }
    if (discountAmount >= price)                                       { setFormError('Discount amount must be less than the price.'); return false }
    return true
  }

  function buildFormData() {
    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('price', form.price)
    fd.append('discountAmount', form.discountAmount || '0')
    fd.append('minThreshold', form.minThreshold || '0')
    fd.append('barcode', form.barcode.trim())
    if (imageFile) fd.append('image', imageFile)
    if (editingId && removeImage) fd.append('removeImage', 'true')
    return fd
  }

  function resetForm() {
    setEditingId(null)
    setEditingProduct(null)
    setFormError('')
    setForm(EMPTY_FORM)
    setImageFile(null)
    setRemoveImage(false)
    setImageError('')
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later (e.g. after Clear)
    if (!file) return
    const err = validateImageFile(file)
    if (err) { setImageError(err); return }
    setImageError('')
    setImageFile(file)
    setRemoveImage(false)
  }

  function clearSelectedImage() {
    setImageFile(null)
    setImageError('')
  }

  function handleRemoveImage() {
    if (!window.confirm("Remove this product's image?")) return
    setImageFile(null)
    setRemoveImage(true)
    setImageError('')
  }

  // What the preview box shows: a newly-picked file wins, then "about to be
  // removed" (nothing), then the product's current image (edit mode only),
  // then nothing (add mode with no selection yet).
  const displayImageUrl = imageFile
    ? imagePreview
    : removeImage
      ? null
      : (editingProduct?.hasImage ? apiUrl(editingProduct.fullUrl) : null)

  async function handleAdd() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const created = await apiFetch('/api/products', {
        method: 'POST',
        body: buildFormData(),
      })
      // A brand-new product has no purchase history yet.
      setProducts(prev => [...prev, { ...created, currentCost: null }].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm()
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
      const updated = await apiFetch(`/api/products/${editingId}`, {
        method: 'PUT',
        body: buildFormData(),
      })
      setProducts(prev =>
        // Editing name/price/discount doesn't touch purchase history — carry
        // the already-known currentCost forward instead of losing it, since
        // the PUT response doesn't include it (see GET /api/products/costs).
        prev.map(p => p.id === editingId ? { ...updated, currentCost: p.currentCost } : p)
            .sort((a, b) => a.name.localeCompare(b.name))
      )
      resetForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(product) {
    setEditingId(product.id)
    setEditingProduct(product)
    setForm({
      name:           product.name,
      price:          String(product.price),
      discountAmount: String(product.discountAmount),
      minThreshold:   String(product.minThreshold),
      barcode:        product.barcode || '',
    })
    setImageFile(null)
    setRemoveImage(false)
    setImageError('')
    setFormError('')
    setSuccessMsg('')
  }

  function openStockModal(product) {
    setStockModal({ open: true, product })
    setStockOp('add')
    setStockQty('')
    setStockRate('')
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
    const rate = parseFloat(stockRate)
    if (stockOp === 'add' && (!Number.isFinite(rate) || rate < 0)) return
    setStockBusy(true)
    setStockErr('')
    try {
      const result = await apiFetch('/api/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id:         stockModal.product.id,
          operation:          stockOp,
          quantity:           qty,
          buyingPricePerUnit: stockOp === 'add' ? rate : undefined,
          note:               stockNote.trim() || null,
        }),
      })
      setProducts(prev =>
        prev.map(p => p.id === stockModal.product.id
          ? { ...p, stock: result.new_stock, ...(stockOp === 'add' ? { currentCost: rate } : {}) }
          : p)
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

  async function quickGenerateBarcode(product) {
    const fd = new FormData()
    fd.append('name', product.name)
    fd.append('price', product.price)
    fd.append('discountAmount', product.discountAmount)
    fd.append('minThreshold', product.minThreshold)
    fd.append('barcode', generateMimicBarcode())
    try {
      const updated = await apiFetch(`/api/products/${product.id}`, { method: 'PUT', body: fd })
      setProducts(prev => prev.map(p => p.id === product.id ? { ...updated, currentCost: p.currentCost } : p))
    } catch (err) {
      window.alert(err.message || 'Failed to generate barcode.')
    }
  }

  function cancelEdit() {
    resetForm()
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
        body: JSON.stringify({ confirmCode: password }),
      })
      setProducts(prev => prev.filter(p => p.id !== deleteModal.productId))
      closeDelete()
    } catch (err) {
      setPwError(err.message === 'Incorrect confirmation code.' ? 'Incorrect. Try again.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewQty   = parseInt(stockQty, 10) || 0
  const currentStk   = stockModal.product?.stock ?? 0
  const previewStock = stockOp === 'add' ? currentStk + previewQty : currentStk - previewQty
  const isOverRemove = stockOp === 'remove' && previewQty > currentStk
  const previewRate  = parseFloat(stockRate)
  const rateValid    = Number.isFinite(previewRate) && previewRate >= 0
  const previewTotalCost = rateValid ? Math.round(previewQty * previewRate * 100) / 100 : 0
  const canConfirm   = previewQty > 0 && !isOverRemove && !stockBusy &&
    (stockOp !== 'add' || rateValid)

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Scan or enter barcode" value={form.barcode}
                  onChange={e => patch({ barcode: e.target.value })}
                  className="flex-1 bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300" />
                <button type="button" onClick={() => patch({ barcode: generateMimicBarcode() })}
                  title="Generate a unique code for products without a manufacturer barcode"
                  className="shrink-0 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors">
                  <Barcode className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Scan with a USB scanner, or click the icon to generate one.</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <div className="flex items-center gap-3">
                <div style={{
                  width: '64px', height: '64px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden',
                  backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {displayImageUrl ? (
                    <img src={displayImageUrl} alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <ImageIcon size={22} strokeWidth={1.5} color="#9ca3af" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                    <label className="inline-block cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                      {displayImageUrl ? 'Change image' : 'Choose image'}
                      <input type="file" accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageSelect} className="hidden" />
                    </label>
                    {imageFile && (
                      <button type="button" onClick={clearSelectedImage}
                        className="text-sm text-gray-500 hover:text-gray-700">
                        Clear
                      </button>
                    )}
                    {editingId && editingProduct?.hasImage && !imageFile && !removeImage && (
                      <button type="button" onClick={handleRemoveImage}
                        className="text-sm text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP. Max 5MB.</p>
                  {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (Rs.)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price}
                onChange={e => patch({ price: e.target.value })}
                className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount (Rs.)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.discountAmount}
                onChange={e => patch({ discountAmount: e.target.value })}
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

            <div className="grid grid-cols-[36px_2fr_1fr_1fr_1fr_1fr_1fr_120px] gap-3 px-5 py-2 text-xs font-semibold text-gray-500 shrink-0 border-b border-gray-100">
              <span></span>
              <span>Product Name</span>
              <span>Buying Price</span>
              <span>Price</span>
              <span>Discount (Rs.)</span>
              <span>Selling Price</span>
              <span>Stock</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 px-6 text-center">
                  <p className="text-sm font-semibold text-red-600">Couldn't load products</p>
                  <p className="text-xs text-gray-500">{loadError}</p>
                  <button
                    onClick={() => { setLoading(true); fetchProducts() }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-sm text-gray-400">No products found</p>
                </div>
              ) : (
                filtered.map(product => {
                  const isLow     = product.stock < product.minThreshold
                  const isEditing = editingId === product.id
                  const fp        = getEffectivePrice(product.price, product.discountAmount).toFixed(2)
                  return (
                    <div key={product.id}
                      className={`grid grid-cols-[36px_2fr_1fr_1fr_1fr_1fr_1fr_120px] gap-3 px-5 py-3 items-center border-b border-gray-50 text-sm ${
                        isEditing ? 'bg-gray-100' : isLow ? 'bg-[#fff5f5]' : 'bg-white'
                      }`}>
                      <InventoryThumbnail product={product} />
                      <span className="font-semibold text-gray-900 truncate">{product.name}</span>
                      <span className="text-gray-600">
                        {product.currentCost !== null ? `Rs. ${product.currentCost.toFixed(2)}` : '—'}
                      </span>
                      <span className="text-gray-600">Rs. {product.price.toFixed(2)}</span>
                      <span className="text-gray-600">Rs. {product.discountAmount.toFixed(2)}</span>
                      <span className="font-bold text-gray-900">Rs. {fp}</span>
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-600'}`}>
                        {product.stock} units
                        {stockSuccess === product.id && (
                          <span className="ml-1.5 text-green-600 text-xs font-bold">✓</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 justify-end">
                        {!product.barcode && (
                          <button onClick={() => quickGenerateBarcode(product)}
                            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-purple-600 hover:border-purple-600 hover:text-white transition-colors"
                            title="Generate barcode">
                            <Barcode className="w-3.5 h-3.5" />
                          </button>
                        )}
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

            {stockOp === 'add' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Buying Price per Unit (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={stockRate}
                  onChange={e => setStockRate(e.target.value)}
                  className="w-full bg-gray-100 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
                />
                {previewQty > 0 && stockRate !== '' && (
                  rateValid ? (
                    <p className="text-sm mt-1.5 font-bold text-gray-900">
                      Total Cost: Rs. {previewTotalCost.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-1.5 font-medium">
                      Buying price must be 0 or greater
                    </p>
                  )
                )}
              </div>
            )}

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

            <label className="block text-sm font-medium text-gray-700 mb-1">Enter Confirmation Code</label>
            <PasswordInput placeholder="Enter 123 to confirm" value={password}
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
