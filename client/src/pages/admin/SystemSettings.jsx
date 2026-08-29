import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, X } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import PasswordInput from '../../components/PasswordInput'

const MODAL_CONFIG = {
  admin: {
    title: 'Admin Password',
    subtitle: 'Change administrator password',
    buttonLabel: 'Update Admin Password',
  },
  cashier: {
    title: 'Cashier Password',
    subtitle: 'Change cashier password',
    buttonLabel: 'Update Cashier Password',
  },
}

const EMPTY_FORM = {
  currentPw: '', newPw: '', confirmPw: '',
  errorField: null, errorMsg: '', success: false,
}

export default function SystemSettings() {
  const navigate = useNavigate()
  const [activeModal, setActiveModal] = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [submitting,  setSubmitting]  = useState(false)
  const [fetchingCurrent, setFetchingCurrent] = useState(false)

  function patch(fields) {
    setForm(prev => ({ ...prev, ...fields }))
  }

  async function openModal(type) {
    setActiveModal(type)
    setForm(EMPTY_FORM)

    if (type === 'cashier') {
      setFetchingCurrent(true)
      try {
        const { password } = await apiFetch('/api/settings/password/cashier')
        patch({ currentPw: password })
      } catch (err) {
        patch({ errorField: 'server', errorMsg: 'Could not load current cashier password.' })
      } finally {
        setFetchingCurrent(false)
      }
    }
  }

  function closeModal() {
    setActiveModal(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit() {
    // Client-side checks before hitting the API
    if (form.newPw.length < 6) {
      patch({ errorField: 'length' }); return
    }
    if (form.confirmPw !== form.newPw) {
      patch({ errorField: 'mismatch' }); return
    }

    setSubmitting(true)
    try {
      await apiFetch('/api/settings/password', {
        method: 'PATCH',
        body: JSON.stringify({
          role:            activeModal,
          currentPassword: form.currentPw,
          newPassword:     form.newPw,
        }),
      })
      patch({ errorField: null, errorMsg: '', success: true })
      setTimeout(closeModal, 1500)
    } catch (err) {
      if (err.message === 'Incorrect current password.') {
        patch({ errorField: 'current', errorMsg: 'Incorrect current password' })
      } else {
        patch({ errorField: 'server', errorMsg: err.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const config = activeModal ? MODAL_CONFIG[activeModal] : null

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
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage system passwords and preferences</p>
          </div>
        </div>
      </div>

      {/* ── CARDS ───────────────────────────────────────────────────── */}
      <div className="flex gap-6 p-6">

        {/* Admin Password card */}
        <button
          onClick={() => openModal('admin')}
          style={{ transition: 'background-color 0.2s ease' }}
          className="flex-1 flex items-center gap-4 border border-gray-400 rounded-xl p-5 bg-white hover:bg-gray-50 text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">Admin Password</p>
            <p className="text-sm text-gray-500 mt-0.5">Change administrator password</p>
          </div>
        </button>

        {/* Cashier Password card */}
        <button
          onClick={() => openModal('cashier')}
          style={{ transition: 'background-color 0.2s ease' }}
          className="flex-1 flex items-center gap-4 border border-gray-400 rounded-xl p-5 bg-white hover:bg-gray-50 text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">Cashier Password</p>
            <p className="text-sm text-gray-500 mt-0.5">Change cashier password</p>
          </div>
        </button>

      </div>

      {/* ── MODAL ───────────────────────────────────────────────────── */}
      {activeModal && config && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-[480px] p-6">

            {/* Modal header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{config.title}</p>
                  <p className="text-sm text-gray-500">{config.subtitle}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success banner */}
            {form.success && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                Password updated successfully!
              </div>
            )}

            {/* Server error banner */}
            {form.errorField === 'server' && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {form.errorMsg}
              </div>
            )}

            {/* Current Password */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
                {activeModal === 'cashier' && <span className="font-normal text-gray-400"> (auto-filled — click the eye icon to view it)</span>}
              </label>
              <PasswordInput
                placeholder={fetchingCurrent ? 'Loading…' : 'Enter current password'}
                value={form.currentPw}
                readOnly={activeModal === 'cashier'}
                onChange={e => activeModal !== 'cashier' && patch({ currentPw: e.target.value, errorField: null, errorMsg: '' })}
                className={`w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 ${activeModal === 'cashier' ? 'cursor-default' : ''}`}
              />
              {form.errorField === 'current' && (
                <p className="text-xs text-red-600 mt-1">{form.errorMsg}</p>
              )}
            </div>

            {/* New Password */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <PasswordInput
                placeholder="Enter new password"
                value={form.newPw}
                onChange={e => patch({ newPw: e.target.value, errorField: null, errorMsg: '' })}
                className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />
              {form.errorField === 'length' && (
                <p className="text-xs text-red-600 mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <PasswordInput
                placeholder="Confirm new password"
                value={form.confirmPw}
                onChange={e => patch({ confirmPw: e.target.value, errorField: null, errorMsg: '' })}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-gray-100 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              />
              {form.errorField === 'mismatch' && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || fetchingCurrent}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Updating…' : config.buttonLabel}
            </button>

          </div>
        </div>
      )}
    </div>
  )
}
