import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Receipt, Calendar, Loader2, AlertCircle,
  ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'
import DatePickerCalendar from '../../components/DatePickerCalendar'

function toDateParam(d) {
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function SalesLog() {
  const navigate = useNavigate()

  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [cashiers,     setCashiers]     = useState([])
  const [cashierFilter, setCashierFilter] = useState('all')

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [itemsCache, setItemsCache] = useState({}) // id -> { status: 'loading'|'loaded'|'error', items?, message? }

  const calendarRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/cashiers').then(setCashiers).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function fetchRows() {
    setLoading(true)
    setError(null)
    setExpandedId(null)
    setItemsCache({})
    const params = new URLSearchParams({ date: toDateParam(selectedDate) })
    if (cashierFilter !== 'all') params.append('cashierId', cashierFilter)
    apiFetch(`/api/transactions/by-date?${params}`)
      .then(setRows)
      .catch(err => setError(err.message || 'Failed to load transactions.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRows()
  }, [selectedDate, cashierFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectDate(date) {
    setSelectedDate(date)
    setCalendarOpen(false)
  }

  function fetchItems(id) {
    setItemsCache(prev => ({ ...prev, [id]: { status: 'loading' } }))
    apiFetch(`/api/transactions/${id}/items`)
      .then(items => setItemsCache(prev => ({ ...prev, [id]: { status: 'loaded', items } })))
      .catch(err => setItemsCache(prev => ({ ...prev, [id]: { status: 'error', message: err.message || 'Failed to load items.' } })))
  }

  function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!itemsCache[id]) fetchItems(id)
  }

  const totalCount = rows.length
  const totalSum   = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              title="Back to Dashboard"
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src={highlandLogo} alt="Highland Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gray-700" />
                <h1 className="text-2xl font-bold text-gray-900">Sales Log</h1>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Browse transactions by date and cashier
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              {loading ? '—' : totalCount}
            </p>
            <p className="text-sm text-gray-500">
              transactions{!loading && totalCount > 0 && (
                <> &middot; Rs. {totalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex-1 p-6 space-y-6">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {/* ── FILTER PANEL ──────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-end gap-4">

              {/* Date picker */}
              <div className="w-[220px] relative" ref={calendarRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                <button
                  onClick={() => setCalendarOpen(o => !o)}
                  className="w-full flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                >
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 text-left text-gray-900">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </button>
                {calendarOpen && (
                  <DatePickerCalendar selectedDate={selectedDate} onDateSelect={selectDate} />
                )}
              </div>

              {/* Cashier dropdown */}
              <div className="w-[240px]">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Cashier</label>
                <select
                  value={cashierFilter}
                  onChange={e => setCashierFilter(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                >
                  <option value="all">All Cashiers</option>
                  {cashiers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.status === 'disabled' ? ' (disabled)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-500 italic">
              Showing transactions for {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>

          {/* ── TRANSACTIONS LIST ─────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">

            {/* Column headers */}
            <div className="flex px-5 py-3 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '40%' }}>Bill No</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '35%' }}>Cashier</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '25%', textAlign: 'right' }}>Total</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-400">Loading transactions...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={fetchRows}
                  className="mt-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Receipt className="w-12 h-12 text-gray-300" />
                <p className="font-bold text-gray-500">No transactions on this date</p>
                <p className="text-sm text-gray-400">Try a different date or cashier</p>
              </div>
            ) : (
              rows.map((txn, i) => {
                const isExpanded = expandedId === txn.id
                const cache = itemsCache[txn.id]
                return (
                  <div
                    key={txn.id}
                    className={isExpanded
                      ? 'my-2 mx-2 rounded-lg border border-blue-100 bg-blue-50/50 overflow-hidden'
                      : 'my-1 mx-2 rounded-lg'}
                    style={isExpanded ? { borderLeft: '4px solid #3b82f6' } : undefined}
                  >
                    <button
                      onClick={() => toggleExpand(txn.id)}
                      className={`w-full flex px-5 py-2.5 items-center text-left transition-colors rounded-lg ${
                        isExpanded ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div style={{ width: '40%' }} className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-blue-500 shrink-0" />
                          : <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                        <div>
                          <span className="font-bold text-gray-900 text-base block">{txn.transactionRef.slice(-7)}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(txn.transactionTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span style={{ width: '35%' }} className="text-sm text-gray-700">{txn.cashierName}</span>
                      <span style={{ width: '25%' }} className="text-base font-bold text-gray-900 text-right">
                        Rs. {txn.total.toFixed(2)}
                      </span>
                    </button>

                    {!isExpanded && i < rows.length - 1 && (
                      <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgb(30 58 138 / 0.7), transparent)' }} />
                    )}

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-blue-100">
                        {!cache || cache.status === 'loading' ? (
                          <div className="flex items-center justify-center py-6 gap-2">
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            <p className="text-sm text-gray-400">Loading items...</p>
                          </div>
                        ) : cache.status === 'error' ? (
                          <div className="flex flex-col items-center justify-center py-6 gap-2">
                            <p className="text-sm text-red-600">{cache.message}</p>
                            <button
                              onClick={() => fetchItems(txn.id)}
                              className="px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <div className="pt-3">
                            <div className="flex px-1 py-2 border-b border-gray-200">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '40%' }}>Product</span>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '20%', textAlign: 'right' }}>Unit Price</span>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '15%', textAlign: 'right' }}>Qty</span>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '25%', textAlign: 'right' }}>Line Total</span>
                            </div>
                            {cache.items.map((item, idx) => (
                              <div key={idx} className="flex px-1 py-2 text-sm">
                                <span style={{ width: '40%' }} className="text-gray-800">{item.name}</span>
                                <span style={{ width: '20%', textAlign: 'right' }} className="text-gray-700">Rs. {item.unitPrice.toFixed(2)}</span>
                                <span style={{ width: '15%', textAlign: 'right' }} className="text-gray-700">{item.qty}</span>
                                <span style={{ width: '25%', textAlign: 'right' }} className="font-medium text-gray-900">Rs. {item.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                            <hr className="border-gray-200 my-3" />
                            <div className="flex justify-between px-1">
                              <span className="text-sm text-gray-500">
                                {txn.cashierName} &middot; {new Date(txn.transactionTime).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}, {new Date(txn.transactionTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="text-sm font-bold text-gray-900">Total: Rs. {txn.total.toFixed(2)}</span>
                            </div>
                            <p className="px-1 mt-1 text-xs text-gray-400">Ref: {txn.transactionRef}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
