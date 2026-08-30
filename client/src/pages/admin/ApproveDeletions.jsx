import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, Check, X, Lock } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import PasswordInput from '../../components/PasswordInput'

export default function ApproveDeletions() {
  const navigate = useNavigate()
  const [requests,   setRequests]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState({ open: false, action: '', request: null })
  const [password,   setPassword]   = useState('')
  const [pwError,    setPwError]    = useState('')
  const [submitting, setSubmitting] = useState(false)

  function fetchRequests() {
    apiFetch('/api/deletion-requests/pending')
      .then(data => setRequests(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRequests()
    window.addEventListener('focus', fetchRequests)
    return () => window.removeEventListener('focus', fetchRequests)
  }, [])

  function openModal(action, request) {
    setModal({ open: true, action, request })
    setPassword('')
    setPwError('')
  }

  function closeModal() {
    setModal({ open: false, action: '', request: null })
    setPassword('')
    setPwError('')
  }

  async function handleConfirm() {
    setSubmitting(true)
    setPwError('')
    try {
      const { deletionRequestId } = modal.request
      const endpoint = modal.action === 'approve'
        ? `/api/deletion-requests/${deletionRequestId}/approve`
        : `/api/deletion-requests/${deletionRequestId}/reject`

      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ confirmCode: password }),
      })

      setRequests(prev => prev.filter(r => r.deletionRequestId !== deletionRequestId))
      closeModal()
    } catch (err) {
      setPwError(err.message === 'Incorrect confirmation code.' ? 'Incorrect. Try again.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Approve Deletion Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review and approve transaction deletions</p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="border border-gray-200 rounded-xl p-5">

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-gray-900">Pending Deletion Requests</h2>
              </div>
              <span className="text-sm text-gray-500">{requests.length} pending</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-400">Loading…</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="font-medium text-gray-600">No pending deletion requests</p>
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map(req => (
                  <div key={req.deletionRequestId} className="bg-[#fefce8] border border-amber-400 rounded-xl p-4">

                    <p className="font-bold text-gray-900 text-sm">{req.transactionRef}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="text-gray-400">Cashier: </span>
                      <span className="font-semibold">{req.cashierName}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.transactionTime}</p>
                    <p className="text-xs font-medium text-amber-600 mt-0.5">Requested: {req.requestedAt}</p>

                    {/* Sold items */}
                    <div className="mt-3 bg-white border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-bold text-gray-900 mb-2">Sold Items:</p>
                      {req.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm mb-1">
                          <span>
                            <span className="text-gray-400">{item.qty}x </span>
                            <span className="font-semibold text-gray-900">{item.name}</span>
                            <span className="text-gray-400"> @ Rs. {item.unitPrice.toFixed(2)}</span>
                          </span>
                          <span className="font-bold text-gray-900">Rs. {item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                      <hr className="my-2 border-amber-100" />
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-gray-900">Total Amount</span>
                        <span className="text-sm font-bold text-gray-900">Rs. {req.total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => openModal('approve', req)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Check className="w-4 h-4" />
                        Approve & Delete
                      </button>
                      <button
                        onClick={() => openModal('reject', req)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-2.5 rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        <X className="w-4 h-4" />
                        Reject Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              {modal.action === 'approve'
                ? 'You are about to approve and delete transaction:'
                : 'You are about to reject the deletion request for:'}
            </p>
            <p className="font-bold text-gray-900 mb-5">{modal.request?.transactionRef}</p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Enter Confirmation Code</label>
            <PasswordInput
              placeholder="Enter 123 to confirm"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwError('') }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />
            {pwError && <p className="text-red-500 text-xs mt-1">{pwError}</p>}

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
