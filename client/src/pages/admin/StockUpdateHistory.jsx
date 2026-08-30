import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, History, Search, Calendar,
  User, Shield, PackageSearch, X, Loader2, AlertCircle, AlertTriangle,
} from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import highlandLogo from '../../images/highland.png'
import DatePickerCalendar from '../../components/DatePickerCalendar'

export default function StockUpdateHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const backRoute = user?.role === 'cashier' ? '/cashier/dashboard' : '/admin/dashboard'

  const [allRecords,      setAllRecords]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter,      setRoleFilter]      = useState('All')
  const [selectedDate,    setSelectedDate]    = useState(null)
  const [calendarOpen,    setCalendarOpen]    = useState(false)
  const [missingCostOnly, setMissingCostOnly] = useState(false)

  const calendarRef   = useRef(null)
  const fetchHistoryRef = useRef(null)

  // Close calendar on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounce search input — avoids an API call on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Re-fetch whenever any filter changes
  useEffect(() => {
    fetchHistory()
  }, [debouncedSearch, roleFilter, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref up-to-date so window focus always calls with current filter state
  useEffect(() => { fetchHistoryRef.current = fetchHistory })
  useEffect(() => {
    const handler = () => fetchHistoryRef.current()
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  async function fetchHistory() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim())
        params.append('search', debouncedSearch.trim())
      if (roleFilter !== 'All')
        params.append('role', roleFilter.toLowerCase())
      if (selectedDate) {
        const yyyy = selectedDate.getFullYear()
        const mm   = String(selectedDate.getMonth() + 1).padStart(2, '0')
        const dd   = String(selectedDate.getDate()).padStart(2, '0')
        params.append('date', `${yyyy}-${mm}-${dd}`)
      }
      const result = await apiFetch(`/api/stock/history?${params}`)
      setAllRecords(result.data)
    } catch (err) {
      setError(err.message || 'Failed to load stock history.')
    } finally {
      setLoading(false)
    }
  }

  function selectDate(date) {
    setSelectedDate(date)
    setCalendarOpen(false)
  }
  function clearDate() {
    setSelectedDate(null)
  }

  // A top-up (positive delta) with no recorded rate is missing cost data —
  // either it predates this feature, or was never filled in. Removals never
  // carry cost data by design, so they're never "missing" it.
  function isMissingCost(record) {
    return record.quantity_added > 0 && record.buying_price_per_unit === null
  }

  const visibleRecords = missingCostOnly ? allRecords.filter(isMissingCost) : allRecords
  const missingCostCount = allRecords.filter(isMissingCost).length

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backRoute)}
              title="Back to Dashboard"
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          <img src={highlandLogo} alt="Highland Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-700" />
                <h1 className="text-2xl font-bold text-gray-900">Stock Update History</h1>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Track all inventory stock changes by admin and cashiers
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{visibleRecords.length}</p>
            <p className="text-sm text-gray-500">records</p>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex-1 p-6 space-y-6">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── FILTER PANEL ──────────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-end gap-4">

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Product or cashier name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            {/* Updated by */}
            <div className="w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Updated by</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="All">All</option>
                <option value="Cashier">Cashier</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Date picker */}
            <div className="flex items-end gap-2">
              <div className="w-[220px] relative" ref={calendarRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                <button
                  onClick={() => setCalendarOpen(o => !o)}
                  className="w-full flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                >
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className={`flex-1 text-left ${selectedDate ? 'text-gray-900' : 'text-gray-400'}`}>
                    {selectedDate
                      ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Pick a date'
                    }
                  </span>
                  {selectedDate && (
                    <X
                      className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
                      onClick={e => { e.stopPropagation(); clearDate() }}
                    />
                  )}
                </button>
                {calendarOpen && (
                  <DatePickerCalendar selectedDate={selectedDate} onDateSelect={selectDate} />
                )}
              </div>

              {/* Clear button — only when date is selected */}
              {selectedDate && (
                <button
                  onClick={clearDate}
                  className="flex items-center gap-1 px-3 py-2.5 border border-gray-200 bg-white rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  × Clear
                </button>
              )}
            </div>
          </div>

          {/* Date info text */}
          {selectedDate && (
            <p className="mt-3 text-sm text-gray-500 italic">
              Showing updates for {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}

          {/* Missing cost data filter */}
          {missingCostCount > 0 && (
            <label className="mt-3 flex items-center gap-2 text-sm text-amber-700 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={missingCostOnly}
                onChange={e => setMissingCostOnly(e.target.checked)}
                className="accent-amber-600"
              />
              <AlertTriangle className="w-3.5 h-3.5" />
              Show only records missing cost data ({missingCostCount})
            </label>
          )}
        </div>

        {/* ── RECORDS TABLE ─────────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">

          {/* Column headers */}
          <div className="flex px-5 py-3 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '19%' }}>Product</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '17%' }}>Updated By</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '15%' }}>Date & Time</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '13%', textAlign: 'right' }}>Qty Changed</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '17%', textAlign: 'right' }}>Price/Unit</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '19%', textAlign: 'right' }}>Total Cost</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-400">Loading records...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={fetchHistory}
                className="mt-1 px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <PackageSearch className="w-12 h-12 text-gray-300" />
              <p className="font-bold text-gray-500">No stock updates found</p>
              <p className="text-sm text-gray-400">Try adjusting your filters</p>
            </div>
          ) : (
            visibleRecords.map((record, i) => (
              <div key={record.id}>
                <div className="flex px-5 py-4 items-center">

                  {/* Product */}
                  <div style={{ width: '19%', minWidth: 0 }} className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 text-base" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {record.product_name}
                    </span>
                    {isMissingCost(record) && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Missing cost data" />
                    )}
                  </div>

                  {/* Updated By */}
                  <div style={{ width: '17%', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                      width: '64px', flexShrink: 0,
                      padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: record.updated_by_role === 'admin' ? '#ede9fe' : '#fce7f3',
                      color: record.updated_by_role === 'admin' ? '#7c3aed' : '#9f1239',
                      whiteSpace: 'nowrap',
                    }}>
                      {record.updated_by_role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                      {record.updated_by_role === 'admin' ? 'Admin' : 'Cashier'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                      {record.updater_name}
                    </span>
                  </div>

                  {/* Date & Time — stacked, not inline, so it can't overflow into
                      the next column at this narrower width */}
                  <div style={{ width: '15%', minWidth: 0, fontSize: '13px', color: '#374151' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {new Date(record.updated_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                      {new Date(record.updated_at).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Qty Changed */}
                  <p className={`text-base font-bold text-right ${
                    record.quantity_added >= 0 ? 'text-green-600' : 'text-red-600'
                  }`} style={{ width: '13%', minWidth: 0, whiteSpace: 'nowrap' }}>
                    {record.quantity_added > 0 ? `+${record.quantity_added}` : record.quantity_added} units
                  </p>

                  {/* Buying Price per Unit — "—" for removals and historical rows with no cost data, never Rs. 0.00 */}
                  <p className="text-sm text-right text-gray-700" style={{ width: '17%', minWidth: 0, whiteSpace: 'nowrap' }}>
                    {record.buying_price_per_unit !== null
                      ? `Rs. ${parseFloat(record.buying_price_per_unit).toFixed(2)}`
                      : '—'}
                  </p>

                  {/* Total Cost */}
                  <p className="text-sm font-bold text-right text-gray-900" style={{ width: '19%', minWidth: 0, whiteSpace: 'nowrap' }}>
                    {record.total_cost !== null
                      ? `Rs. ${parseFloat(record.total_cost).toFixed(2)}`
                      : '—'}
                  </p>
                </div>
                {i < visibleRecords.length - 1 && <hr className="border-gray-100" />}
              </div>
            ))
          )}
        </div>
        </div>{/* end max-width wrapper */}
      </div>
    </div>
  )
}
