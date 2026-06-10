import { Outlet } from 'react-router-dom'

export default function CashierLayout() {
  return (
    <div className="h-screen bg-gray-100">
      <Outlet />
    </div>
  )
}
