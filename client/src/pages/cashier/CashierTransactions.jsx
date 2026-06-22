import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, AlertCircle, Trash2, Undo2 } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'

export default function CashierTransactions() {
  const navigate = useNavigate()
  const [completedTransactions, setCompletedTransactions] = useState([])
  const [pendingDeletions,      setPendingDeletions]      = useState([])
  const [loading,               setLoading]               = useState(true)

  function fetchTransactions() {
    apiFetch('/api/transactions')
      .then(data => {
        setCompletedTransactions(data.filter(t => t.deletionStatus !== 'pending'))
        setPendingDeletions(data.filter(t => t.deletionStatus === 'pending'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTransactions()
    window.addEventListener('focus', fetchTransactions)
    return () => window.removeEventListener('focus', fetchTransactions)
  }, [])

  async function handleDeleteRequest(txn) {
    try {
      const { deletionRequestId } = await apiFetch('/api/deletion-requests', {
        method: 'POST',
        body: JSON.stringify({ transactionId: txn.id }),
      })
      setCompletedTransactions(prev => prev.filter(t => t.id !== txn.id))
      setPendingDeletions(prev => {
        if (prev.find(p => p.id === txn.id)) return prev
        return [...prev, { ...txn, deletionRequestId, deletionStatus: 'pending' }]
      })
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRevert(txnId) {
    const txn = pendingDeletions.find(p => p.id === txnId)
    if (!txn) return
    try {
      await apiFetch(`/api/deletion-requests/${txn.deletionRequestId}`, { method: 'DELETE' })
      setPendingDeletions(prev => prev.filter(p => p.id !== txnId))
      const { deletionStatus, deletionRequestId, ...originalTxn } = txn
      setCompletedTransactions(prev => [...prev, originalTxn])
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cashier/dashboard')}
            title="Back to Terminal"
            className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={highlandLogo} alt="Highland Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%' }} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Today's Transactions</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and manage transactions</p>
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN BODY ──────────────────────────────────────────── */}
      <div className="flex gap-6 p-6 flex-1 items-start">

        {/* ── LEFT — Completed Transactions ────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-700" />
              <h2 className="font-bold text-gray-900">Completed Transactions</h2>
            </div>
            <span className="text-sm text-gray-500">{completedTransactions.length} transactions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          ) : completedTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">No transactions today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedTransactions.map((txn, index) => (
                <div key={txn.id} style={{ backgroundColor: index % 2 === 0 ? '#f3f4f6' : '#e5e7eb', border: '1px solid #e5e7eb', borderLeft: '4px solid #3b82f6', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>

                  {/* Ref + trash button */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900 text-sm">{txn.transactionRef}</span>
                    <button
                      onClick={() => handleDeleteRequest(txn)}
                      title="Request deletion"
                      className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mb-3">
                    <span className="font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{txn.cashierName}</span> • {txn.time}
                  </p>
                  <hr className="border-gray-100 mb-3" />

                  {txn.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.qty}x {item.name}</span>
                      <span className="text-gray-700">Rs. {item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}

                  <hr className="border-gray-100 my-3" />
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold text-gray-900">Rs. {txn.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT — Pending Deletion Requests ────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900">Pending Deletion Requests</h2>
            </div>
            <span className="text-sm text-gray-500">{pendingDeletions.length} pending</span>
          </div>

          {pendingDeletions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-400">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDeletions.map((txn, index) => (
                <div key={txn.id} style={{ backgroundColor: index % 2 === 0 ? '#fef9c3' : '#fde68a', border: '1px solid #f59e0b', borderLeft: '4px solid #f59e0b', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>

                  {/* Ref + revert button */}
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-gray-900 text-sm">{txn.transactionRef}</p>
                    <button
                      onClick={() => handleRevert(txn.id)}
                      title="Cancel deletion request"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Revert
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{txn.cashierName}</span> • {txn.time}
                  </p>
                  <p className="text-xs font-medium text-amber-600 mb-3">Awaiting admin approval</p>
                  <hr className="border-amber-200 mb-3" />

                  {txn.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.qty}x {item.name}</span>
                      <span className="text-gray-700">Rs. {item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}

                  <hr className="border-amber-200 my-3" />
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold text-gray-900">Rs. {txn.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
