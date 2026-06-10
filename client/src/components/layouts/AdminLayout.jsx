import { Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md shrink-0">
        <div className="p-4 text-xl font-bold">POS Admin</div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
