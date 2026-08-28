import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import PasswordInput from '../components/PasswordInput'
import loginBg from '../images/login-page.jpg'
import highlandLogo from '../images/highland.png'

export default function Login() {
  const { role } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()

  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const title = role === 'cashier' ? 'Cashier Login' : 'Admin Login'

  async function handleLogin() {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, password }),
      })
      auth.login({ role: data.role })
      navigate(data.role === 'admin' ? '/admin/dashboard' : '/cashier/dashboard')
    } catch (err) {
      setError(err.message === 'Incorrect password.'
        ? 'Incorrect password. Please try again.'
        : 'Cannot connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content sits above the overlay */}
      <div className="relative flex flex-col flex-1">

        {/* Back link */}
        <div className="p-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-white border border-white/40 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            ← Back to role selection
          </Link>
        </div>

        {/* Centered card */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-[520px] bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl p-8">

            {/* Logo + Title */}
            <div className="flex flex-col items-center mb-6">
              <img
                src={highlandLogo}
                alt="Highland Logo"
                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '50%', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))', marginBottom: '14px' }}
              />
              <h1 className="text-2xl font-bold text-center text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500 text-center mt-1">Highland Kottawa POS</p>
            </div>

            {/* Password input */}
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <PasswordInput
              placeholder="Enter your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 mb-1"
            />

            {/* Error message */}
            {error && (
              <p className="text-red-500 text-sm mt-1 mb-3">{error}</p>
            )}

            {/* Login button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-3 bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>

          </div>
        </div>

      </div>
    </div>
  )
}
