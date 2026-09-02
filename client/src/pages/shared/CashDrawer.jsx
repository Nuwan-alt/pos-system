import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CreditCard, Lock, Unlock, AlertTriangle,
  CheckCircle2, TrendingUp, RotateCcw, User, Shield,
  CalendarX, X, Clock, Calendar, Loader2, AlertCircle,
  Pencil, Info,
} from 'lucide-react'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'
import DatePickerCalendar from '../../components/DatePickerCalendar'
import PasswordInput from '../../components/PasswordInput'

// ── HELPERS ───────────────────────────────────────────────────────────────────

function formatAmount(n) {
  return `Rs. ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(datetimeStr) {
  if (!datetimeStr) return null
  const date = new Date(datetimeStr)
  if (isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}


const RoleBadge = ({ role, name }) => (
  <span style={{
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '3px',
    padding:         '2px 8px',
    borderRadius:    '9999px',
    fontSize:        '11px',
    fontWeight:      '600',
    backgroundColor: role === 'admin' ? '#ede9fe' : '#fce7f3',
    color:           role === 'admin' ? '#7c3aed'  : '#9f1239',
  }}>
    {role === 'admin' ? <Shield size={10} /> : <User size={10} />}
    {name}
  </span>
)

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function CashDrawer({ isAdmin, backRoute, backLabel }) {
  const navigate = useNavigate()

  // ── Core state ───────────────────────────────────────────────────────────────
  const [todayDrawer,    setTodayDrawer]    = useState(null)
  // Today's completed sales total — always present so the close form can show
  // "Expected Closing" (opening + sales) before the drawer is actually closed.
  // The server recomputes this itself at close time; this is preview-only.
  const [todaySales,     setTodaySales]     = useState(0)
  // Set only when today has no drawer of its own AND a previous day's
  // drawer was left open — the case POST /open blocks on. Lets admin close
  // it directly instead of hitting a dead end.
  const [staleOpenDrawer,   setStaleOpenDrawer]   = useState(null)
  const [staleClosingNote,  setStaleClosingNote]  = useState('')
  const [historyRecords, setHistoryRecords] = useState([])
  const [cashiers,       setCashiers]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [submitting,     setSubmitting]     = useState(false)
  const [error,          setError]          = useState(null)
  const [activeTab,      setActiveTab]      = useState('today')

  // ── Open-drawer form state ───────────────────────────────────────────────────
  const [selectedOpenCashierId,  setSelectedOpenCashierId]  = useState('')
  const [openingAmount,          setOpeningAmount]          = useState('')
  const [openingNote,            setOpeningNote]            = useState('')

  // ── Close-drawer form state — no amount field: the closing amount is
  //    always calculated server-side from opening_amount + today's sales.
  //    Cashiers must re-enter the cashier password to confirm closing;
  //    admin closing skips this (mirrors admin bypassing verifyAdminPassword).
  const [selectedCloseCashierId, setSelectedCloseCashierId] = useState('')
  const [closingNote,            setClosingNote]            = useState('')
  const [closePassword,          setClosePassword]          = useState('')
  const [closePasswordError,     setClosePasswordError]     = useState(false)

  // ── Reset-modal state ────────────────────────────────────────────────────────
  const [resetModalOpen,      setResetModalOpen]      = useState(false)
  const [resetPassword,       setResetPassword]       = useState('')
  const [resetPasswordError,  setResetPasswordError]  = useState(false)
  const [resetSubmitting,     setResetSubmitting]     = useState(false)

  // ── History-filter state ─────────────────────────────────────────────────────
  const [historyDateFilter, setHistoryDateFilter] = useState(null)
  const [calendarOpen,      setCalendarOpen]      = useState(false)
  const calendarRef = useRef(null)

  // ── Edit-modal state (admin only) ────────────────────────────────────────────
  const [editModal,         setEditModal]         = useState({ open: false, record: null })
  const [editForm,          setEditForm]          = useState({ opening_amount: '', opening_note: '', closing_amount: '', closing_note: '', adminPassword: '' })
  const [editPasswordError, setEditPasswordError] = useState(false)
  const [editSubmitting,    setEditSubmitting]    = useState(false)

  // ── Click-outside to close calendar ─────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Fetch functions ──────────────────────────────────────────────────────────

  async function fetchTodayDrawer() {
    try {
      const result = await apiFetch('/api/drawer/today')
      setTodayDrawer(result.data)
      setTodaySales(result.todaySales ?? 0)
      setStaleOpenDrawer(result.staleOpenDrawer ?? null)
    } catch (err) {
      console.error('Failed to fetch today drawer:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchHistory() {
    try {
      const params = new URLSearchParams()
      if (historyDateFilter) {
        const yyyy = historyDateFilter.getFullYear()
        const mm   = String(historyDateFilter.getMonth() + 1).padStart(2, '0')
        const dd   = String(historyDateFilter.getDate()).padStart(2, '0')
        params.append('date', `${yyyy}-${mm}-${dd}`)
      }
      const result = await apiFetch(`/api/drawer/history?${params}`)
      setHistoryRecords(result.data)
    } catch (err) {
      console.error('Failed to fetch drawer history:', err)
    }
  }

  async function fetchCashiers() {
    try {
      const data = await apiFetch('/api/cashiers/active')
      setCashiers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch cashiers:', err)
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Initial load
  useEffect(() => {
    fetchTodayDrawer()
    if (!isAdmin) {
      fetchCashiers()
      window.addEventListener('focus', fetchCashiers)
      return () => window.removeEventListener('focus', fetchCashiers)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history on mount and whenever the date filter changes
  useEffect(() => {
    fetchHistory()
  }, [historyDateFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch today when switching to Today tab (in case another session changed it)
  useEffect(() => {
    if (activeTab === 'today') fetchTodayDrawer()
    if (activeTab === 'history') fetchHistory()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll today's drawer every 30s so admin and cashier stay in sync
  useEffect(() => {
    const interval = setInterval(fetchTodayDrawer, 30000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch on window focus
  useEffect(() => {
    function handleFocus() { fetchTodayDrawer() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function showError(msg) {
    setError(msg)
    setTimeout(() => setError(null), 5000)
  }

  async function handleOpenDrawer() {
    setSubmitting(true)
    setError(null)
    try {
      const cashier = !isAdmin
        ? cashiers.find(c => c.id === parseInt(selectedOpenCashierId))
        : null
      const result = await apiFetch('/api/drawer/open', {
        method: 'POST',
        body: JSON.stringify({
          opening_amount: parseFloat(openingAmount),
          note:           openingNote || null,
          opened_by_role: isAdmin ? 'admin' : 'cashier',
          opened_by_id:   isAdmin ? 1 : parseInt(selectedOpenCashierId),
          opened_by_name: isAdmin ? 'Admin' : cashier?.name,
        }),
      })
      setTodayDrawer(result.data)
      setOpeningAmount('')
      setOpeningNote('')
      setSelectedOpenCashierId('')
      fetchHistory()
    } catch (err) {
      showError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseDrawer() {
    setSubmitting(true)
    setError(null)
    setClosePasswordError(false)
    try {
      const cashier = !isAdmin
        ? cashiers.find(c => c.id === parseInt(selectedCloseCashierId))
        : null
      const result = await apiFetch('/api/drawer/close', {
        method: 'POST',
        body: JSON.stringify({
          note:            closingNote || null,
          closed_by_role:  isAdmin ? 'admin' : 'cashier',
          closed_by_id:    isAdmin ? 1 : parseInt(selectedCloseCashierId),
          closed_by_name:  isAdmin ? 'Admin' : cashier?.name,
          cashierPassword: isAdmin ? undefined : closePassword,
        }),
      })
      setTodayDrawer(result.data)
      setClosingNote('')
      setSelectedCloseCashierId('')
      setClosePassword('')
      fetchHistory()
    } catch (err) {
      if (!isAdmin && err.message?.toLowerCase().includes('password')) {
        setClosePasswordError(true)
      } else {
        showError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Admin-only: close a previous day's drawer that was never closed, so a
  // new drawer can be opened today. Reuses POST /drawer/close as-is — it
  // already finds "whichever drawer is open" regardless of date; admin
  // closing needs no cashier password, same as the normal close flow.
  async function handleCloseStaleDrawer() {
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/drawer/close', {
        method: 'POST',
        body: JSON.stringify({
          note:           staleClosingNote || null,
          closed_by_role: 'admin',
          closed_by_id:   1,
          closed_by_name: 'Admin',
        }),
      })
      setStaleOpenDrawer(null)
      setStaleClosingNote('')
      fetchHistory()
      fetchTodayDrawer()
    } catch (err) {
      showError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEditOpen(record) {
    setEditModal({ open: true, record })
    setEditForm({
      opening_amount: record.opening_amount ?? '',
      opening_note:   record.opening_note   ?? '',
      closing_amount: record.closing_amount ?? '',
      closing_note:   record.closing_note   ?? '',
      adminPassword:  '',
    })
    setEditPasswordError(false)
  }

  function closeEditModal() {
    setEditModal({ open: false, record: null })
    setEditPasswordError(false)
  }

  async function handleEditSave() {
    setEditSubmitting(true)
    setEditPasswordError(false)
    try {
      await apiFetch(`/api/drawer/${editModal.record.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          adminPassword:  editForm.adminPassword,
          opening_amount: parseFloat(editForm.opening_amount),
          opening_note:   editForm.opening_note  || null,
          closing_amount: editForm.closing_amount !== '' ? parseFloat(editForm.closing_amount) : null,
          closing_note:   editForm.closing_note  || null,
        }),
      })
      closeEditModal()
      fetchHistory()
      fetchTodayDrawer()
    } catch (err) {
      if (err.message?.toLowerCase().includes('password') || err.message?.toLowerCase().includes('incorrect')) {
        setEditPasswordError(true)
      } else {
        showError(err.message)
        closeEditModal()
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleReset(password) {
    setResetSubmitting(true)
    setResetPasswordError(false)
    try {
      await apiFetch('/api/drawer/reset', {
        method: 'POST',
        body: JSON.stringify({ confirmCode: password }),
      })
      setTodayDrawer(null)
      setResetModalOpen(false)
      setResetPassword('')
      fetchHistory()
    } catch {
      setResetPasswordError(true)
    } finally {
      setResetSubmitting(false)
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const canOpen = !submitting && (
    !isAdmin
      ? selectedOpenCashierId !== '' && parseFloat(openingAmount) > 0
      : parseFloat(openingAmount) > 0
  )

  // No amount to validate — closing is always computed server-side. A
  // cashier must also select themselves and re-enter the cashier password;
  // admin has neither requirement.
  const canClose = !submitting && (
    !isAdmin ? selectedCloseCashierId !== '' && closePassword !== '' : true
  )

  const expectedClosing = todayDrawer
    ? Math.round((parseFloat(todayDrawer.opening_amount) + todaySales) * 100) / 100
    : null

  const diff = todayDrawer?.closing_amount != null
    ? parseFloat(todayDrawer.closing_amount) - parseFloat(todayDrawer.opening_amount)
    : null

  // ── Status badge ─────────────────────────────────────────────────────────────

  const statusBadge = todayDrawer === null && staleOpenDrawer ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
      style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
      <AlertTriangle className="w-3.5 h-3.5" /> Previous Drawer Open
    </span>
  ) : todayDrawer === null ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
      style={{ backgroundColor: '#fefce8', borderColor: '#fde68a', color: '#d97706' }}>
      <AlertTriangle className="w-3.5 h-3.5" /> Not Started
    </span>
  ) : todayDrawer.status === 'open' ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
      style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#3b82f6' }}>
      <Lock className="w-3.5 h-3.5" /> Drawer Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border"
      style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
      <Lock className="w-3.5 h-3.5" /> Drawer Closed
    </span>
  )

  // ── Summary card (reused in State B and C) ───────────────────────────────────

  const summaryCard = todayDrawer && (
    <div className="border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-700" />
          <span className="font-bold text-gray-900">
            Today — {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setResetModalOpen(true)}
            style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#d97706', borderRadius: '8px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fde68a'; e.currentTarget.style.borderColor = '#d97706' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef3c7'; e.currentTarget.style.borderColor = '#f59e0b' }}
          >
            <RotateCcw size={14} color="#d97706" /> Reset
          </button>
        )}
      </div>

      <div className={`grid gap-4 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>

        {/* Opening */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6', borderRadius: '12px', padding: '16px', flex: 1 }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lock size={14} color="#3b82f6" />
            <span className="text-xs font-semibold" style={{ color: '#3b82f6' }}>Opening</span>
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">
            {formatAmount(todayDrawer.opening_amount)}
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
            <Clock className="w-3 h-3" /> {formatTime(todayDrawer.opening_time)}
          </p>
          <RoleBadge role={todayDrawer.opened_by_role} name={todayDrawer.opened_by_name} />
        </div>

        {/* Closing */}
        <div style={todayDrawer.closing_amount != null
          ? { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a', borderRadius: '12px', padding: '16px', flex: 1 }
          : { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: '4px solid #d1d5db', borderRadius: '12px', padding: '16px', flex: 1 }
        }>
          <div className="flex items-center gap-1.5 mb-2">
            <Unlock size={14} color={todayDrawer.closing_amount != null ? '#16a34a' : '#9ca3af'} />
            <span className="text-xs font-semibold" style={{ color: todayDrawer.closing_amount != null ? '#16a34a' : '#6b7280' }}>Closing</span>
          </div>
          {todayDrawer.closing_amount != null ? (
            <>
              <p className="text-lg font-bold text-gray-900 mb-1">
                {formatAmount(todayDrawer.closing_amount)}
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3" /> {formatTime(todayDrawer.closing_time)}
              </p>
              <RoleBadge role={todayDrawer.closed_by_role} name={todayDrawer.closed_by_name} />
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-200">—</p>
          )}
        </div>

        {/* Difference — admin only */}
        {isAdmin && (
          <div style={diff === null
            ? { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: '4px solid #d1d5db', borderRadius: '12px', padding: '16px', flex: 1 }
            : diff >= 0
              ? { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a', borderRadius: '12px', padding: '16px', flex: 1 }
              : { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: '12px', padding: '16px', flex: 1 }
          }>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} color={diff === null ? '#9ca3af' : diff >= 0 ? '#16a34a' : '#ef4444'} />
              <span className="text-xs font-semibold" style={{ color: diff === null ? '#6b7280' : diff >= 0 ? '#16a34a' : '#ef4444' }}>Difference</span>
            </div>
            {diff === null ? (
              <p className="text-2xl font-bold text-gray-200">—</p>
            ) : diff > 0 ? (
              <p className="text-lg font-bold text-green-600">+{formatAmount(diff)}</p>
            ) : diff < 0 ? (
              <p className="text-lg font-bold text-red-600">-{formatAmount(Math.abs(diff))}</p>
            ) : (
              <p className="text-lg font-bold text-gray-500">{formatAmount(0)}</p>
            )}
          </div>
        )}

      </div>
    </div>
  )

  // ── Error banner ─────────────────────────────────────────────────────────────

  const errorBanner = error && (
    <div className="flex items-center gap-3 rounded-xl border p-4 mb-4"
      style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
      <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
      <p className="text-sm text-red-600">{error}</p>
    </div>
  )

  // ── Loading spinner ───────────────────────────────────────────────────────────

  const loadingSpinner = (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      <p className="text-sm text-gray-400">Loading drawer data...</p>
    </div>
  )

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backRoute)}
              title={backLabel}
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          <img src={highlandLogo} alt="Highland Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-700" />
                <h1 className="text-2xl font-bold text-gray-900">Cash Drawer</h1>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Track daily opening and closing drawer amounts
              </p>
            </div>
          </div>
          {!loading && statusBadge}
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 px-6 shrink-0">
        {[
          { key: 'today',   label: "Today's Drawer" },
          { key: 'history', label: 'History' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-1 mr-8 text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#111827] text-[#111827] font-bold'
                : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ TODAY'S DRAWER TAB ════════════════════════════════════ */}
        {activeTab === 'today' && (
          loading ? loadingSpinner : (
            <div className="p-6">
              <div className="max-w-[700px] mx-auto space-y-5">

                {/* STATE A-STALE — Not Started because a previous day's
                    drawer was never closed. Admin can close it here; a
                    cashier just sees why they can't open today's drawer. */}
                {todayDrawer === null && staleOpenDrawer && (
                  <div className="border rounded-xl p-6" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#fee2e2' }}>
                        <AlertTriangle className="w-4 h-4" style={{ color: '#dc2626' }} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Previous Drawer Still Open</p>
                        <p className="text-sm text-gray-600">
                          The drawer from{' '}
                          {staleOpenDrawer.drawer_date
                            ? new Date(staleOpenDrawer.drawer_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                            : 'a previous day'}
                          {' '}was never closed.{' '}
                          {isAdmin
                            ? "Close it below before opening today's drawer."
                            : "Ask an admin to close it before opening today's drawer."}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6', borderRadius: '12px', padding: '16px' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Lock size={14} color="#3b82f6" />
                          <span className="text-xs font-semibold" style={{ color: '#3b82f6' }}>Opening</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900 mb-1">
                          {formatAmount(staleOpenDrawer.opening_amount)}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                          <Clock className="w-3 h-3" /> {formatTime(staleOpenDrawer.opening_time)}
                        </p>
                        <RoleBadge role={staleOpenDrawer.opened_by_role} name={staleOpenDrawer.opened_by_name} />
                      </div>
                      <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: '4px solid #d1d5db', borderRadius: '12px', padding: '16px' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp size={14} color="#9ca3af" />
                          <span className="text-xs font-semibold text-gray-500">Sales That Day</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatAmount(staleOpenDrawer.today_sales)}
                        </p>
                      </div>
                    </div>

                    {isAdmin ? (
                      <>
                        <div className="mb-5">
                          <label className="block text-sm font-bold text-gray-700 mb-1">
                            Closing Note{' '}
                            <span className="font-normal text-gray-400 italic">(optional)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Closed retroactively — left open overnight"
                            value={staleClosingNote}
                            onChange={e => setStaleClosingNote(e.target.value)}
                            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                            style={{ backgroundColor: '#f3f4f6' }}
                          />
                        </div>

                        {errorBanner}

                        <button
                          onClick={handleCloseStaleDrawer}
                          disabled={submitting}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white transition-colors"
                          style={{ backgroundColor: submitting ? '#9ca3af' : '#dc2626' }}
                        >
                          {submitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Closing...</>
                          ) : (
                            <><Unlock className="w-4 h-4" /> Close Previous Drawer</>
                          )}
                        </button>
                      </>
                    ) : errorBanner}
                  </div>
                )}

                {/* STATE A — Not Started */}
                {todayDrawer === null && !staleOpenDrawer && (
                  <div className="border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Open Drawer</p>
                        <p className="text-sm text-gray-500">
                          Enter the starting cash amount in the drawer for today
                        </p>
                      </div>
                    </div>

                    {!isAdmin && (
                      <div className="mb-4">
                        <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                          <User className="w-3.5 h-3.5" /> Select Cashier
                        </label>
                        <select
                          value={selectedOpenCashierId}
                          onChange={e => setSelectedOpenCashierId(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                          style={{ backgroundColor: '#f3f4f6' }}
                        >
                          <option value="">-- Select Cashier --</option>
                          {cashiers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Opening Amount (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={openingAmount}
                        onChange={e => setOpeningAmount(e.target.value)}
                        className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
                        style={{ backgroundColor: '#f3f4f6' }}
                      />
                    </div>

                    <div className="mb-5">
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Note{' '}
                        <span className="font-normal text-gray-400 italic">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Counted and verified"
                        value={openingNote}
                        onChange={e => setOpeningNote(e.target.value)}
                        className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                        style={{ backgroundColor: '#f3f4f6' }}
                      />
                    </div>

                    {errorBanner}

                    <button
                      onClick={handleOpenDrawer}
                      disabled={!canOpen}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                        canOpen
                          ? 'bg-[#111827] text-white hover:bg-gray-800'
                          : 'text-white cursor-not-allowed'
                      }`}
                      style={!canOpen ? { backgroundColor: '#9ca3af' } : {}}
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Opening...</>
                      ) : (
                        <><Lock className="w-4 h-4" /> Open Drawer</>
                      )}
                    </button>
                  </div>
                )}

                {/* STATE B — Open: summary + close form */}
                {todayDrawer?.status === 'open' && (
                  <>
                    {summaryCard}

                    <div className="border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <Unlock className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Close Drawer</p>
                          <p className="text-sm text-gray-500">Closing amount is calculated automatically from today's sales</p>
                        </div>
                      </div>

                      {!isAdmin && (
                        <div className="mb-4">
                          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                            <User className="w-3.5 h-3.5" /> Select Cashier
                          </label>
                          <select
                            value={selectedCloseCashierId}
                            onChange={e => setSelectedCloseCashierId(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                            style={{ backgroundColor: '#f3f4f6' }}
                          >
                            <option value="">-- Select Cashier --</option>
                            {cashiers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Expected Closing preview — read-only breakdown of what
                          the server will compute; no amount is ever entered here. */}
                      <div className="mb-4 rounded-lg p-4" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                          <span>Opening Amount</span>
                          <span>{formatAmount(todayDrawer.opening_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                          <span>+ Today's Sales</span>
                          <span>{formatAmount(todaySales)}</span>
                        </div>
                        <hr className="border-gray-200 my-2" />
                        <div className="flex justify-between text-base font-bold text-gray-900">
                          <span>Expected Closing</span>
                          <span>{formatAmount(expectedClosing)}</span>
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Note{' '}
                          <span className="font-normal text-gray-400 italic">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. End of day count"
                          value={closingNote}
                          onChange={e => setClosingNote(e.target.value)}
                          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                          style={{ backgroundColor: '#f3f4f6' }}
                        />
                      </div>

                      {/* Confirm with the cashier password — admin has full
                          system access already and doesn't need this. */}
                      {!isAdmin && (
                        <div className="mb-5">
                          <label className="block text-sm font-bold text-gray-700 mb-1">
                            Confirm Cashier Password
                          </label>
                          <PasswordInput
                            placeholder="Enter cashier password"
                            value={closePassword}
                            onChange={e => { setClosePassword(e.target.value); setClosePasswordError(false) }}
                            onKeyDown={e => e.key === 'Enter' && canClose && handleCloseDrawer()}
                            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                            style={{ backgroundColor: '#f3f4f6' }}
                          />
                          {closePasswordError && (
                            <p className="text-red-500 text-xs mt-1">Incorrect cashier password.</p>
                          )}
                        </div>
                      )}

                      {errorBanner}

                      <button
                        onClick={handleCloseDrawer}
                        disabled={!canClose}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                          canClose
                            ? 'bg-[#111827] text-white hover:bg-gray-800'
                            : 'text-white cursor-not-allowed'
                        }`}
                        style={!canClose ? { backgroundColor: '#9ca3af' } : {}}
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Closing...</>
                        ) : (
                          <><Unlock className="w-4 h-4" /> Close Drawer</>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* STATE C — Closed: summary + banner */}
                {todayDrawer?.status === 'closed' && (
                  <>
                    {summaryCard}
                    <div
                      className="rounded-xl border p-4 flex items-start gap-3"
                      style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                      <p className="text-sm font-medium" style={{ color: '#16a34a' }}>
                        Drawer has been opened and closed for today. Switch to the History tab to view past records.
                      </p>
                    </div>
                  </>
                )}

              </div>
            </div>
          )
        )}

        {/* ══ HISTORY TAB ══════════════════════════════════════════ */}
        {activeTab === 'history' && (
          loading ? loadingSpinner : (
            <div className="p-6 space-y-5">

              {/* Filter panel */}
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Filter by Date
                </p>
                <div className="relative inline-block" ref={calendarRef}>
                  <button
                    onClick={() => setCalendarOpen(o => !o)}
                    className="flex items-center gap-2 bg-gray-200 border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-w-[200px]"
                  >
                    <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className={`flex-1 text-left ${historyDateFilter ? 'text-gray-900' : 'text-gray-400'}`}>
                      {historyDateFilter
                        ? historyDateFilter.toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : 'All dates'
                      }
                    </span>
                    {historyDateFilter && (
                      <X
                        className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
                        onClick={e => { e.stopPropagation(); setHistoryDateFilter(null) }}
                      />
                    )}
                  </button>
                  {calendarOpen && (
                    <DatePickerCalendar
                      selectedDate={historyDateFilter}
                      onDateSelect={date => { setHistoryDateFilter(date); setCalendarOpen(false) }}
                    />
                  )}
                </div>
              </div>

              {/* History table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">

                <div className={`px-5 py-3 border-b border-gray-200 grid ${isAdmin ? 'grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_80px]' : 'grid-cols-[2.5fr_1fr_1fr_1fr]'}`}>
                  {['Date', 'Opening', 'Closing', ...(isAdmin ? ['Difference'] : []), 'Status', ...(isAdmin ? ['Actions'] : [])].map(h => (
                    <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </span>
                  ))}
                </div>

                {historyRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <CalendarX className="w-12 h-12 text-gray-300" />
                    <p className="font-bold text-gray-500">No drawer records found</p>
                  </div>
                ) : (
                  historyRecords.map((rec, i) => {
                    const recDiff = rec.closing_amount != null
                      ? parseFloat(rec.closing_amount) - parseFloat(rec.opening_amount)
                      : null
                    return (
                      <div key={rec.id}>
                        <div className={`px-5 py-4 items-start grid ${isAdmin ? 'grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_80px]' : 'grid-cols-[2.5fr_1fr_1fr_1fr]'}`}>

                          {/* Date */}
                          <div>
                            <p className="font-bold text-gray-900 text-sm">
                              {rec.drawer_date ? new Date(rec.drawer_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(rec.opening_time)}
                              {rec.closing_time && ` — ${formatTime(rec.closing_time)}`}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <RoleBadge role={rec.opened_by_role} name={rec.opened_by_name} />
                              {rec.closed_by_role && (
                                <RoleBadge role={rec.closed_by_role} name={rec.closed_by_name} />
                              )}
                            </div>
                          </div>

                          {/* Opening */}
                          <p className="text-sm text-gray-900 font-medium">
                            {formatAmount(rec.opening_amount)}
                          </p>

                          {/* Closing */}
                          <p className="text-sm text-gray-900 font-medium">
                            {rec.closing_amount != null
                              ? formatAmount(rec.closing_amount)
                              : <span className="text-gray-300 font-bold text-base">—</span>
                            }
                          </p>

                          {/* Difference — admin only */}
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              {recDiff === null ? (
                                <span className="text-gray-300 font-bold text-base">—</span>
                              ) : recDiff > 0 ? (
                                <>
                                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                  <span className="text-sm font-bold text-green-600">+{formatAmount(recDiff)}</span>
                                </>
                              ) : recDiff < 0 ? (
                                <span className="text-sm font-bold text-red-600">-{formatAmount(Math.abs(recDiff))}</span>
                              ) : (
                                <span className="text-sm font-bold text-gray-500">{formatAmount(0)}</span>
                              )}
                            </div>
                          )}

                          {/* Status */}
                          <div>
                            {rec.status === 'open' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                                <Lock className="w-3 h-3" /> Open
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                                <Lock className="w-3 h-3" /> Closed
                              </span>
                            )}
                          </div>

                          {/* Actions — admin only */}
                          {isAdmin && (
                            <div>
                              <button
                                onClick={() => handleEditOpen(rec)}
                                style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd' }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                              >
                                <Pencil size={13} /> Edit
                              </button>
                            </div>
                          )}

                        </div>
                        {i < historyRecords.length - 1 && <hr className="border-gray-100" />}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Cashier read-only notice */}
              {!isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', marginTop: '12px', fontSize: '13px', color: '#0369a1' }}>
                  <Info size={14} />
                  Drawer history is view-only for cashiers. Contact admin to make corrections.
                </div>
              )}

            </div>
          )
        )}

      </div>

      {/* ── EDIT DRAWER MODAL (Admin only) ──────────────────────────── */}
      {editModal.open && editModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-[480px] p-6">

            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#dbeafe' }}>
                  <Pencil size={16} color="#3b82f6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Edit Drawer Record</p>
                  <p className="text-xs text-gray-400">
                    {editModal.record.drawer_date
                      ? new Date(editModal.record.drawer_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : ''}
                  </p>
                </div>
              </div>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <hr className="my-4 border-gray-100" />

            {/* Opening Amount */}
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Opening Amount (Rs.)</label>
              <input
                type="number" min="0" step="0.01"
                value={editForm.opening_amount}
                onChange={e => setEditForm(f => ({ ...f, opening_amount: e.target.value }))}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
                style={{ backgroundColor: '#f3f4f6' }}
              />
            </div>

            {/* Opening Note */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Opening Note <span className="font-normal text-gray-400 italic">(optional)</span>
              </label>
              <input
                type="text"
                value={editForm.opening_note}
                onChange={e => setEditForm(f => ({ ...f, opening_note: e.target.value }))}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                style={{ backgroundColor: '#f3f4f6' }}
              />
            </div>

            {/* Closing fields — only if record is closed */}
            {editModal.record.status === 'closed' && (
              <>
                {/* Closing Amount */}
                <div className="mb-3">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Closing Amount (Rs.)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editForm.closing_amount}
                    onChange={e => setEditForm(f => ({ ...f, closing_amount: e.target.value }))}
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 no-spinner"
                    style={{ backgroundColor: '#f3f4f6' }}
                  />
                </div>

                {/* Live difference preview */}
                {editForm.opening_amount !== '' && editForm.closing_amount !== '' && (() => {
                  const previewDiff = parseFloat(editForm.closing_amount) - parseFloat(editForm.opening_amount)
                  const isPos = previewDiff >= 0
                  return (
                    <p className="text-xs mb-3" style={{ color: isPos ? '#16a34a' : '#ef4444' }}>
                      New Difference: {isPos ? '+' : '-'}{formatAmount(Math.abs(previewDiff))}
                    </p>
                  )
                })()}

                {/* Closing Note */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Closing Note <span className="font-normal text-gray-400 italic">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.closing_note}
                    onChange={e => setEditForm(f => ({ ...f, closing_note: e.target.value }))}
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                    style={{ backgroundColor: '#f3f4f6' }}
                  />
                </div>
              </>
            )}

            {/* Admin Password */}
            <div className="mb-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Admin Password</label>
              <PasswordInput
                placeholder="Enter admin password"
                value={editForm.adminPassword}
                onChange={e => { setEditForm(f => ({ ...f, adminPassword: e.target.value })); setEditPasswordError(false) }}
                onKeyDown={e => e.key === 'Enter' && !editSubmitting && handleEditSave()}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                style={{ backgroundColor: '#f3f4f6' }}
              />
              {editPasswordError && (
                <p className="text-red-500 text-xs mt-1">Incorrect password. Try again.</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={closeEditModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSubmitting || !editForm.adminPassword}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#111827' }}
              >
                {editSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── RESET CONFIRMATION MODAL (Admin only) ───────────────────── */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-[400px] p-6">

            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#fef3c7' }}>
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                </div>
                <span className="font-bold text-gray-900">Reset Drawer</span>
              </div>
              <button
                onClick={() => {
                  setResetModalOpen(false)
                  setResetPassword('')
                  setResetPasswordError(false)
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              This will clear today's drawer record. You will need to re-enter the opening amount.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter Confirmation Code
            </label>
            <PasswordInput
              placeholder="Enter 123 to confirm"
              value={resetPassword}
              onChange={e => { setResetPassword(e.target.value); setResetPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && !resetSubmitting && handleReset(resetPassword)}
              className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />
            {resetPasswordError && (
              <p className="text-red-500 text-xs mt-1">Incorrect. Try again.</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setResetModalOpen(false)
                  setResetPassword('')
                  setResetPasswordError(false)
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReset(resetPassword)}
                disabled={resetSubmitting}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#dc2626' }}
              >
                {resetSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</>
                ) : 'Confirm'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
