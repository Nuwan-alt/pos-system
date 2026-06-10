import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleSelection from './pages/RoleSelection'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageUsers from './pages/admin/ManageUsers'
import SystemSettings from './pages/admin/SystemSettings'
import ApproveDeletions from './pages/admin/ApproveDeletions'
import ManageInventory from './pages/admin/ManageInventory'
import TransactionReports from './pages/admin/TransactionReports'
import CashierTerminal from './pages/cashier/CashierTerminal'
import CashierTransactions from './pages/cashier/CashierTransactions'

const router = createBrowserRouter([
  { path: '/',               element: <RoleSelection /> },
  { path: '/login/:role',    element: <Login /> },

  // Admin routes
  { path: '/admin/dashboard', element: <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute> },
  { path: '/admin/users',     element: <ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute> },
  { path: '/admin/inventory', element: <ProtectedRoute role="admin"><ManageInventory /></ProtectedRoute> },
  { path: '/admin/deletions', element: <ProtectedRoute role="admin"><ApproveDeletions /></ProtectedRoute> },
  { path: '/admin/reports',   element: <ProtectedRoute role="admin"><TransactionReports /></ProtectedRoute> },
  { path: '/admin/settings',  element: <ProtectedRoute role="admin"><SystemSettings /></ProtectedRoute> },

  // Cashier routes
  { path: '/cashier/dashboard',     element: <ProtectedRoute role="cashier"><CashierTerminal /></ProtectedRoute> },
  { path: '/cashier/transactions',  element: <ProtectedRoute role="cashier"><CashierTransactions /></ProtectedRoute> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
