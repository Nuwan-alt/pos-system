import { useNavigate } from 'react-router-dom'
import { ShieldCheck, User } from 'lucide-react'
import roleBg from '../images/role-selection.jpg'

export default function RoleSelection() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative px-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${roleBg})` }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full">

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">Point of Sale System</h1>
        <p className="text-white/70 mt-2 text-base">Select your role to continue</p>
      </div>

      <div className="w-full max-w-[520px] space-y-4">
        {/* Admin card */}
        <button
          onClick={() => navigate('/login/admin')}
          className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col items-center hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-gray-500" />
          </div>
          <span className="text-lg font-bold text-gray-900">Admin</span>
          <span className="text-base text-gray-500 mt-1">Access system settings and reports</span>
        </button>

        {/* Cashier card */}
        <button
          onClick={() => navigate('/login/cashier')}
          className="w-full bg-[#F3F4F6] border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col items-center hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center mb-3">
            <User className="w-7 h-7 text-gray-500" />
          </div>
          <span className="text-base font-bold text-gray-900">Cashier</span>
          <span className="text-sm text-gray-500 mt-1">Process sales and transactions</span>
        </button>
      </div>

      </div>

      {/* Decorative help button */}
      <button className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center select-none">
        ?
      </button>
    </div>
  )
}
