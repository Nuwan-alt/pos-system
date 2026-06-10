import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, UserX, UserCheck, Trash2, Lock, X } from 'lucide-react'
import { apiFetch } from '../../lib/api'

export default function ManageUsers() {
  const navigate = useNavigate()
  const [cashiers, setCashiers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [modal,    setModal]    = useState({ open: false, action: '', cashierId: null, cashierName: '' })
  const [password,      setPassword]      = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [submitting,    setSubmitting]    = useState(false)

  const total    = cashiers.length
  const active   = cashiers.filter(c => c.status === 'active').length
  const disabled = cashiers.filter(c => c.status === 'disabled').length

  useEffect(() => {
    apiFetch('/api/cashiers')
      .then(data => setCashiers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function createCashier() {
    if (!newName.trim()) return
    try {
      const created = await apiFetch('/api/cashiers', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setCashiers(prev => [...prev, created])
      setNewName('')
    } catch (err) {
      alert(err.message)
    }
  }

  function openModal(action, cashierId, cashierName) {
    setModal({ open: true, action, cashierId, cashierName })
    setPassword('')
    setPasswordError('')
  }

  function closeModal() {
    setModal({ open: false, action: '', cashierId: null, cashierName: '' })
    setPassword('')
    setPasswordError('')
  }

  async function handleConfirm() {
    setSubmitting(true)
    setPasswordError('')
    try {
      const { action, cashierId } = modal
      if (action === 'enable' || action === 'disable') {
        const newStatus = action === 'enable' ? 'active' : 'disabled'
        await apiFetch(`/api/cashiers/${cashierId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus, adminPassword: password }),
        })
        setCashiers(prev => prev.map(c => c.id === cashierId ? { ...c, status: newStatus } : c))
      } else if (action === 'delete') {
        await apiFetch(`/api/cashiers/${cashierId}`, {
          method: 'DELETE',
          body: JSON.stringify({ adminPassword: password }),
        })
        setCashiers(prev => prev.filter(c => c.id !== cashierId))
      }
      closeModal()
    } catch (err) {
      setPasswordError(err.message === 'Incorrect admin password.' ? 'Incorrect password. Try again.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const actionLabel = { enable: 'enable', disable: 'disable', delete: 'delete' }[modal.action] ?? ''

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            title="Back to Dashboard"
            className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage cashier accounts</p>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex gap-6 p-6 flex-1 items-start">

        {/* ── LEFT — Add New Cashier ───────────────────────────────── */}
        <div className="w-[35%] shrink-0 border border-gray-400 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Add New Cashier</h2>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1">Cashier Name</label>
          <input
            type="text"
            placeholder="Enter cashier name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createCashier()}
            className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 mb-4"
          />
          <button
            onClick={createCashier}
            disabled={!newName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Create Cashier
          </button>

          <hr className="my-5 border-gray-100" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-600">Total Cashiers</span>
              <span className="font-bold text-gray-900">{total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-600">Active</span>
              <span className="font-bold text-green-600">{active}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-600">Disabled</span>
              <span className="font-bold text-red-600">{disabled}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Cashier Accounts ─────────────────────────────── */}
        <div className="flex-1 min-w-0 border border-gray-400 rounded-xl p-5">
          <h2 className="font-bold text-gray-900 mb-4">Cashier Accounts</h2>

          {loading ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          ) : cashiers.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-sm text-gray-400">No cashier accounts yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cashiers.map(cashier => (
                <div
                  key={cashier.id}
                  className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{cashier.name}</span>
                      {cashier.status === 'active' ? (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs font-medium bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">Disabled</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Created: {cashier.createdAt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {cashier.status === 'active' ? (
                      <button
                        onClick={() => openModal('disable', cashier.id, cashier.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-500 text-red-600 bg-white rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <UserX className="w-4 h-4" />
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal('enable', cashier.id, cashier.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-green-600 text-green-700 bg-white rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <UserCheck className="w-4 h-4" />
                        Enable
                      </button>
                    )}
                    <button
                      onClick={() => openModal('delete', cashier.id, cashier.name)}
                      className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ───────────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-bold text-gray-900">Confirm Action</span>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              You are about to <span className="font-bold text-gray-900">{actionLabel}</span> the cashier:
            </p>
            <p className="font-bold text-gray-900 mb-5">{modal.cashierName}</p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Enter Admin Password</label>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />
            {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
