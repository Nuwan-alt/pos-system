import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Password <input> with a show/hide toggle. Forwards all other props
// (value, onChange, placeholder, onKeyDown, style, ...) straight to the
// input — callers keep their existing styling, just append pr-10 via
// className so the toggle button doesn't overlap typed text.
export default function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={`pr-10 ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
