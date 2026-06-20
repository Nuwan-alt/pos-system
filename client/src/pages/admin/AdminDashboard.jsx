import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, DollarSign, BarChart2, Users, Package,
  UserCog, Clock, Settings, History, CreditCard,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import highlandLogo from '../../images/highland.png'

const STAT_CONFIG = [
  { key: 'todaySales',        icon: DollarSign, iconBg: '#bfdbfe', bg: '#eff6ff', hoverBg: '#dbeafe', label: "Today's Sales",   format: v => `Rs. ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
  { key: 'todayTransactions', icon: BarChart2,  iconBg: '#bbf7d0', bg: '#f0fdf4', hoverBg: '#dcfce7', label: 'Transactions',    format: v => String(v) },
  { key: 'activeCashiers',    icon: Users,      iconBg: '#e9d5ff', bg: '#faf5ff', hoverBg: '#f3e8ff', label: 'Active Cashiers', format: v => String(v) },
  { key: 'totalProducts',     icon: Package,    iconBg: '#fed7aa', bg: '#fff7ed', hoverBg: '#ffedd5', label: 'Products',        format: v => String(v) },
]

const QUICK_ACTIONS = [
  { icon: UserCog,  title: 'Manage Users',      subtitle: 'Create and manage cashier accounts',    route: '/admin/users' },
  { icon: Package,  title: 'Manage Inventory',  subtitle: 'Add products and track stock',          route: '/admin/inventory' },
  { icon: Clock,    title: 'Approve Deletions', subtitle: 'Review transaction deletion requests',  route: '/admin/deletions' },
  { icon: BarChart2,   title: 'View Reports',          subtitle: 'Sales summaries and analytics',            route: '/admin/reports' },
  { icon: CreditCard, title: 'Cash Drawer',           subtitle: 'Track daily opening and closing amounts',  route: '/admin/drawer' },
  { icon: History,    title: 'Stock Update History',  subtitle: 'View who updated stock and when',          route: '/admin/stock-history' },
  { icon: Settings,   title: 'System Settings',       subtitle: 'Configure system preferences',             route: '/admin/settings' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [stats,       setStats]       = useState(null)
  const [hoveredStat, setHoveredStat] = useState(null)

  function fetchStats() {
    apiFetch('/api/dashboard/stats').then(setStats).catch(() => {})
  }

  useEffect(() => {
    fetchStats()
    window.addEventListener('focus', fetchStats)
    return () => window.removeEventListener('focus', fetchStats)
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={highlandLogo}
            alt="Highland Logo"
            style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '50%' }}
          />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>Admin Dashboard</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Highland Kottawa POS</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 space-y-8">

        {/* ── SECTION 1 — Stats ─────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {STAT_CONFIG.map((card, i) => {
            const Icon  = card.icon
            const value = stats ? card.format(stats[card.key]) : '—'
            return (
              <div
                key={card.label}
                onMouseEnter={() => setHoveredStat(i)}
                onMouseLeave={() => setHoveredStat(null)}
                style={{
                  backgroundColor: hoveredStat === i ? card.hoverBg : card.bg,
                  transition: 'background-color 0.2s ease',
                }}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: card.iconBg }}
                  >
                    <Icon className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-base text-gray-500 mt-1">{card.label}</p>
              </div>
            )
          })}
        </div>

        {/* ── SECTION 2 — Quick Actions ─────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.title}
                  onClick={() => navigate(action.route)}
                  style={{ transition: 'background-color 0.2s ease, border-color 0.2s ease' }}
                  className="relative text-left rounded-xl border border-gray-300 bg-white p-5 flex flex-col gap-3 cursor-pointer hover:bg-gray-200 hover:border-gray-500"
                >
                  {/* Pending deletions badge */}
                  {action.route === '/admin/deletions' && stats?.pendingDeletions > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[24px] h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                      {stats.pendingDeletions}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-gray-300 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-900" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{action.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{action.subtitle}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </main>
    </div>
  )
}
