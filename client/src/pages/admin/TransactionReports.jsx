import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, DollarSign, TrendingUp, Search } from 'lucide-react'
import { apiFetch } from '../../lib/api'

const PERIODS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7',     label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'thisYear',  label: 'This Year' },
]

export default function TransactionReports() {
  const navigate = useNavigate()
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [report,         setReport]         = useState(null)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch(`/api/reports?period=${selectedPeriod}`)
      .then(data => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [selectedPeriod])

  const productRows = useMemo(() => {
    if (!report) return []
    if (!searchQuery.trim()) return report.productRows
    return report.productRows.filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [report, searchQuery])

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
            <h1 className="text-2xl font-bold text-gray-900">Transaction Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">View sales summaries and product performance</p>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── SECTION 1 — Period selector ─────────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-5">
            <p className="font-bold text-gray-900 mb-4">Select Period</p>
            <div className="flex gap-2 flex-wrap">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setSelectedPeriod(p.key)}
                  style={{ transition: 'background-color 0.15s, color 0.15s' }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedPeriod === p.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── SECTION 2 — Summary stats ───────────────────────────── */}
          <div className="flex gap-6">

            {/* Total Transactions */}
            <div className="flex-1 relative bg-blue-200 hover:bg-blue-300 border border-blue-300 rounded-xl overflow-hidden transition-colors duration-200 min-h-40">
              <div className="absolute top-0 left-0 w-12 h-12 bg-blue-400 rounded-br-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-900" />
              </div>
              <div className="flex flex-col items-center justify-center h-full py-8">
                <p className="text-5xl font-bold text-gray-900">
                  {loading ? '—' : report?.totalTransactions ?? 0}
                </p>
                <p className="text-base font-semibold text-gray-800 mt-2">Total Transactions</p>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="flex-1 relative bg-green-200 hover:bg-green-300 border border-green-300 rounded-xl overflow-hidden transition-colors duration-200 min-h-40">
              <div className="absolute top-0 left-0 w-12 h-12 bg-green-400 rounded-br-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-900" />
              </div>
              <div className="flex flex-col items-center justify-center h-full py-8">
                <p className="text-5xl font-bold text-gray-900">
                  {loading ? '—' : (report?.totalRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-base font-semibold text-gray-800 mt-2">Total Revenue (Rs.)</p>
              </div>
            </div>

          </div>

          {/* ── SECTION 3 — Product-wise Sales ──────────────────────── */}
          <div className="border border-gray-200 rounded-xl p-5">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-700" />
                <h2 className="font-bold text-gray-900">Product-wise Sales</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 w-52"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-400">Loading…</p>
              </div>
            ) : !report || report.totalTransactions === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-400">No transactions found for this period</p>
              </div>
            ) : (
              <>
                <div className="flex text-xs font-semibold text-gray-500 pb-2">
                  <span className="flex-[3]">Product Name</span>
                  <span className="flex-1 text-center">Quantity (units)</span>
                  <span className="flex-1 text-right">Revenue (Rs.)</span>
                </div>
                <hr className="border-gray-100 mb-1" />

                {productRows.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-400">No products match your search</p>
                  </div>
                ) : (
                  productRows.map((row, i) => (
                    <div
                      key={row.name}
                      className={`flex items-center py-3 px-3 rounded-lg ${
                        i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } ${i < productRows.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                      <span className="flex-[3] font-bold text-gray-900 text-sm">{row.name}</span>
                      <span className="flex-1 text-center text-sm text-gray-500">{row.qty}</span>
                      <span className="flex-1 text-right font-bold text-gray-900 text-sm">
                        {row.revenue.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
