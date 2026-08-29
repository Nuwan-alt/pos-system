import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { POSProvider } from './context/POSContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleSelection from './pages/RoleSelection'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageUsers from './pages/admin/ManageUsers'
import SystemSettings from './pages/admin/SystemSettings'
import ApproveDeletions from './pages/admin/ApproveDeletions'
import ManageInventory from './pages/admin/ManageInventory'
import TransactionReports from './pages/admin/TransactionReports'
import StockUpdateHistory from './pages/admin/StockUpdateHistory'
import SalesLog from './pages/admin/SalesLog'
import CashDrawer from './pages/shared/CashDrawer'
import CashierTerminal from './pages/cashier/CashierTerminal'
import CashierTransactions from './pages/cashier/CashierTransactions'
import UpdateStock from './pages/cashier/UpdateStock'

const router = createBrowserRouter([
  { path: '/',               element: <RoleSelection /> },
  { path: '/login/:role',    element: <Login /> },

  // Admin routes
  { path: '/admin/dashboard', element: <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute> },
  { path: '/admin/users',     element: <ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute> },
  { path: '/admin/inventory', element: <ProtectedRoute role="admin"><ManageInventory /></ProtectedRoute> },
  { path: '/admin/deletions', element: <ProtectedRoute role="admin"><ApproveDeletions /></ProtectedRoute> },
  { path: '/admin/reports',   element: <ProtectedRoute role="admin"><TransactionReports /></ProtectedRoute> },
  { path: '/admin/settings',      element: <ProtectedRoute role="admin"><SystemSettings /></ProtectedRoute> },
  { path: '/admin/stock-history', element: <ProtectedRoute role="admin"><StockUpdateHistory /></ProtectedRoute> },
  { path: '/admin/sales-log',     element: <ProtectedRoute role="admin"><SalesLog /></ProtectedRoute> },
  { path: '/admin/drawer',        element: <ProtectedRoute role="admin"><CashDrawer isAdmin={true}  backRoute="/admin/dashboard" backLabel="Back to Dashboard" /></ProtectedRoute> },

  // Cashier routes
  { path: '/cashier/dashboard',     element: <ProtectedRoute role="cashier"><CashierTerminal /></ProtectedRoute> },
  { path: '/cashier/transactions',  element: <ProtectedRoute role="cashier"><CashierTransactions /></ProtectedRoute> },
  { path: '/cashier/update-stock',  element: <ProtectedRoute role="cashier"><UpdateStock /></ProtectedRoute> },
  { path: '/cashier/drawer',        element: <ProtectedRoute role="cashier"><CashDrawer isAdmin={false} backRoute="/cashier/dashboard" backLabel="Back to Cashier" /></ProtectedRoute> },
])

export default function App() {
  return (
    <AuthProvider>
      <POSProvider>
        <RouterProvider router={router} />
      </POSProvider>
    </AuthProvider>
  )
}
