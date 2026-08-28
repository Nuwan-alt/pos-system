const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export async function apiFetch(path, options = {}) {
  // FormData (image uploads) must not get a manual Content-Type — the
  // browser sets its own multipart boundary. JSON bodies keep the header.
  const isFormData = options.body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    headers: isFormData ? { ...options.headers } : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Server error')
  return data
}

// Server responses give back API-relative paths (e.g. a product's
// thumbnailUrl) — this resolves them against the same base apiFetch uses,
// for <img> tags and anything else that can't go through apiFetch itself.
export function apiUrl(path) {
  return `${API_BASE}${path}`
}
